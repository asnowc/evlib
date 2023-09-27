import type { Readable } from "node:stream";
import { UnderlyingSource, ReadableStreamController, ReadableByteStreamController } from "stream/web";
interface QueueNode<T> {
    data: T;
    next: QueueNode<T> | null;
}
interface BufferList<T> {
    head: QueueNode<T> | null;
    tail: QueueNode<T> | null;
    length: number;

    push(v: T): void;
    unshift(v: T): void;

    shift(): undefined | T;

    clear(): void;
    /** 将队列中所有chunk拼接, 队列保持不变, 返回拼接的内容 */
    join(s: string): string;

    /** 将队列中所有chunk连接, 队列保持不变, 返回连接后的值 */
    concat(n: number): Buffer;

    /** 读取指定长度, 读取的部分被移除 */
    consume(n: number): Buffer;
    consume(n: number, hasStrings: false | undefined): Buffer;
    consume(n: number, hasStrings: true): string;
    consume(n: number, hasStrings?: boolean): T;

    /** 返回队头的值, 使用去要确保head存在 */
    first(): T;

    [Symbol.iterator](): Generator<T, void, void>;
}
interface ReadableState<T> {
    objectMode: boolean;
    highWaterMark: number;
    buffer: BufferList<T>;
    pipes: ReadableState<T>[];
    length: number;
    flowing: null;
    ended: boolean;
    endEmitted: boolean;
    reading: boolean;

    /**
     * 流仍在构建中，在构建完成或失败之前不能被破坏。
     * 异步构造是可选的，因此我们从构造开始。
     */
    constructed: boolean;
    sync: boolean;
    needReadable: boolean;
    emittedReadable: boolean;
    readableListening: boolean;
    resumeScheduled: boolean;
    /** 如果错误已经发出且不应再次抛出，则为True。 */
    errorEmitted: boolean;
    /** 应该在销毁时发出close。默认为true。 */
    emitClose: boolean;
    /** 应该在'end'(也可能是'finish')之后调用.destroy()吗? */
    autoDestroy: boolean;
    destroyed: boolean;
    /**
     * 值为异常
     * 指示流是否发生错误。当真实不再调用_read时，应该发生'data'或'readable'事件。
     * 这是必需的，因为当autoDestroy被禁用时，我们需要一种方法来判断流是否失败。
     */
    errored: false | unknown;
    /** 指示流是否已完成销毁 */
    closed: boolean;
    /** 如果close已经发出或将会根据emitClose发出，则为True。 */
    closeEmitted: boolean;
}
interface InternalReadable<T> extends Readable {
    _readableState: ReadableState<T>;
}
export function fromList<T>(n: number, state: ReadableState<T>): T | undefined {
    // nothing buffered.
    if (state.length === 0) return;

    let ret: T | Buffer | undefined;
    if (state.objectMode) ret = state.buffer.shift();
    else if (!n || n >= state.length) {
        // Read it all, truncate the list.
        if (state.buffer.length === 1) ret = state.buffer.first();
        else ret = state.buffer.concat(state.length);
        state.buffer.clear();
    } else {
        // read part of list.
        ret = state.buffer.consume(n);
    }

    return ret as any;
}
export class ReadableSource<T> implements UnderlyingSource {
    constructor(readable: Readable, type?: "bytes");
    constructor(private readable: InternalReadable<T>, type?: "bytes") {
        this.type = type;
        if (type === "bytes") {
            this.queue = bytesQueueHandler as any;
        }
        this.readableState = readable._readableState;
        this.objectMode = readable.readableObjectMode;
    }
    private readonly objectMode;
    private readableState: ReadableState<T>;
    start(ctrl: ReadableStreamController<T>) {
        const readable = this.readable;
        if (readable.readableEnded) {
            ctrl.close();
            this.ctrlClosed = true;
            return;
        } else if (readable.errored) {
            ctrl.error(readable.errored);
            return;
        } else if (readable.closed || readable.destroyed) {
            ctrl.error(new Error("raw stream closed"));
            return;
        }
        readable.on("close", () => {
            if (this.waiting) {
                if (this.readableState.errored) this.waiting.reject(this.readableState.errored);
                else this.waiting.resolve({ closed: true });
                this.waiting = undefined;
            } else if (!this.ctrlClosed) {
                if (this.readableState.errored) {
                    ctrl.error(this.readableState.errored);
                } else {
                    ctrl.close();
                }
            }
        });
        readable.on("error", (err) => {
            if (!this.ctrlClosed) ctrl.error(err);
        });

        readable.on("readable", () => {}); //确保触发底层读取
        /** 拦截内部函数 */
        const queue = this.readableState.buffer; //readable queue
        const oldPush = queue.push;
        queue.push = (chunk) => {
            if (this.waiting) {
                this.waiting.resolve({ value: chunk });
                this.waiting = undefined;
            } else {
                return oldPush.call(queue, chunk);
            }
        };
    }
    private queue(ctrl: ReadableStreamController<T>, chunk: T) {
        ctrl.enqueue(chunk);
    }
    private ctrlClosed = false;
    private waiting?: { resolve(chunk: { closed?: boolean; value?: T }): void; reject(reason?: any): void };
    pull(ctrl: ReadableStreamController<T>) {
        const readableQueue = this.readableState.buffer;
        if (this.readableState.errored) {
            ctrl.error(this.readable.errored);
        } else if (readableQueue.length) {
            const chunk = readableQueue.shift()!;
            this.readableState.length -= this.objectMode ? 1 : (chunk as unknown as Uint8Array).byteLength;
            this.queue(ctrl, chunk);
            if (readableQueue.length === 0 && this.readableState.ended) {
                this.readable.read(); //触发readable的对应事件
                ctrl.close();
                this.ctrlClosed = true;
            }
            return;
        } else if (this.readableState.ended || this.readableState.closed) {
            this.readable.read(); //触发readable的对应事件
            ctrl.close();
            this.ctrlClosed = true;
            return;
        }
        return new Promise<{ closed?: boolean; value?: T }>((resolve, reject) => {
            this.waiting = { resolve, reject };
        }).then(
            ({ closed, value }) => {
                if (closed) ctrl.close();
                else this.queue(ctrl, value!);
            },
            (err) => ctrl.error(err)
        );
    }
    cancel(reason?: unknown): void | PromiseLike<void> {
        this.readable.destroy(reason as any);
        //todo: socket处理中断
    }
    type: any;
}
interface ReadableStreamBYOBRequest {
    readonly view: ArrayBufferView | null;
    respond(bytesWritten: number): void;
    respondWithNewView(view: ArrayBufferView): void;
}

const fastArrayBuffer = Buffer.allocUnsafe(1).buffer;
/** 可读字节流chunk处理，避免将 node 的 Buffer 的底层 转移*/
function bytesQueueHandler(ctrl: ReadableByteStreamController, chunk: Uint8Array) {
    if (chunk.buffer === fastArrayBuffer) {
        const buffer = new Uint8Array(chunk.byteLength);
        buffer.set(chunk);
        chunk = buffer;
    }
    const byobRequest = ctrl.byobRequest as unknown as ReadableStreamBYOBRequest | null;
    if (byobRequest) {
        byobRequest.respondWithNewView(chunk as any);
    } else {
        ctrl.enqueue(chunk);
    }
}
