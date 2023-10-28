import { Writable } from "node:stream";
import { UnderlyingSink, WritableStreamDefaultController } from "node:stream/web";
import { InternalWritable, WritableState } from "./stream_core.js";

export class WritableCore<T> implements UnderlyingSink<T> {
    constructor(writable: Writable);
    constructor(private writable: InternalWritable) {
        this.state = writable._writableState;
    }
    private state: WritableState;
    private closed = false;
    start(ctrl: WritableStreamDefaultController) {
        const writable = this.writable;
        if (!writable.writable) {
            ctrl.error(writable.errored ?? new Error("raw stream is ended"));
            return;
        }
        const onClose = () => {
            if (!this.closed) ctrl.error(writable.errored ?? new Error("raw stream closed"));
            this.closed = true;
        };
        writable.on("close", onClose);
        writable.on("error", onClose);
    }
    abort(reason?: any): void | PromiseLike<void> {
        this.writable.destroy(reason);
    }
    close(): void | PromiseLike<void> {
        this.closed = true;
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
                this.writable.write(chunk, (err) => (err ? reject(err) : resolve()));
            });
        }
    }
    type?: undefined;
}
