import { Writable } from "node:stream";
import { UnderlyingSink, WritableStreamDefaultController } from "node:stream/web";

interface WriteableState {
    /**
     * 流仍在构建中，在构建完成或失败之前不能被破坏。
     * 异步构造是可选的，因此我们从构造开始。
     */
    constructed: boolean;
    finalCalled: boolean;
    destroyed: boolean;
    corked: number;
    ended: boolean;
    errored: null | Error;
    finished: boolean;
    length: number;
    objectMode: boolean;
}
interface InternalWritable<T> extends Writable {
    _writableState: WriteableState;
}

export class WritableCore<T> implements UnderlyingSink<T> {
    constructor(writable: Writable);
    constructor(private writable: InternalWritable<T>) {
        this.state = writable._writableState;
    }
    private state: WriteableState;
    private errored = false;
    start(ctrl: WritableStreamDefaultController) {
        const writable = this.writable;
        if (writable.errored) {
            ctrl.error(writable.errored);
            this.errored = true;
            return;
        } else if (writable.writableFinished) {
            ctrl.error(new Error("writable finished"));
            this.errored = true;
            return;
        } else if (writable.closed || writable.destroyed) {
            ctrl.error(new Error("raw stream closed"));
            this.errored = true;
            return;
        }
        //todo: 通过其他方式拦截close
        writable.on("close", () => {
            if (!this.errored) {
                ctrl.error(writable.errored);
                this.errored = true;
            }
        });
        //todo: 通过其他方式拦截error
        writable.on("error", (err) => {
            ctrl.error(err);
            this.errored = true;
        });
    }
    abort(reason?: any): void | PromiseLike<void> {
        this.writable.destroy(reason);
    }
    close(): void | PromiseLike<void> {
        this.errored = true;
        return new Promise((resolve, reject) => {
            this.writable.end(() => resolve());
        });
    }
    write(chunk: T, ctrl: WritableStreamDefaultController): void | PromiseLike<void> {
        if (this.state.constructed) {
            /* let resolve: () => void, reject: (err?: any) => void;
            let async = false;
            let called = false;
            this.writable._write(chunk, "buffer" as any, (err) => {
                if (async) {
                    err ? reject(err) : resolve();
                }
                called = true;
            });
            if (called) {
                return new Promise((resolveFn, rejectFn) => {
                    resolve = resolveFn;
                    reject = rejectFn;
                });
            } else async = true; */

            /** 绕过 Writable 的内部机制，直接调用 _write()  */
            return new Promise((resolve, reject) => {
                this.writable._write(chunk, "buffer" as any, (err) => (err === undefined ? resolve() : reject(err)));
            });
        } else {
            /** 没有完成初始化，不能直接调用 _write() */
            //todo: 想办法监听 writable 完成初始化的事件，由 start() 函数处理
            return new Promise((resolve, reject) => {
                this.writable.write(chunk, (err) => (err === undefined ? resolve() : reject(err)));
            });
        }
    }
    type?: undefined;
}
