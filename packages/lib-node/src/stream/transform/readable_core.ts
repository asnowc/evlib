import type { Readable } from "node:stream";
import type { InternalReadable, ReadableState } from "./stream_core.js";
import type { UnderlyingSource, ReadableStreamController, ReadableByteStreamController } from "stream/web";
import { getStreamError, streamIsAlive } from "./stream_core.js";

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
        }
        const error = getStreamError(readable); //readable.errored required node 18
        if (error) {
            ctrl.error(error);
            return;
        } else if (!streamIsAlive(readable)) {
            ctrl.error(new Error("raw stream closed"));
            return;
        }
        const tryClose = (error?: Error | null) => {
            //没有进行读取，但是流已经关闭
            if (!this.ctrlClosed) {
                if (error) ctrl.error(error);
                else ctrl.close();
                this.ctrlClosed = true;
            }
        };
        readable.on("close", () => {
            const errored = getStreamError(readable);
            if (this.waiting) {
                if (errored) this.waiting.reject(errored);
                else this.waiting.resolve(undefined); //触发 close
                this.waiting = undefined;
                return true;
            } else tryClose(errored);
        });
        readable.on("end", tryClose);

        readable.on("error", (err) => {
            ctrl.error(err);
        });

        //确保触发底层读取
        readable.on("readable", () => {
            if (this.waiting) {
                //理论上至少命中 readableState.length 或 readableState.ended
                const res = this.takeChunkFromReadableState()!;
                if (res.chunk) this.waiting.resolve(res.chunk);
                else if (res.err) this.waiting.reject(res.err);
                else this.waiting.resolve(undefined);
                this.waiting = undefined;
            } else if (this.readableState.length === 0) readable.read(); //触发更新
        });
    }
    /**
     * @remarks 如果流可以读取、或已关闭、或已出错，则返回信息
     * @returns undefined: 需要等待流读取
     */
    private takeChunkFromReadableState(): WaitChunkRes<T> | undefined {
        const readableQueue = this.readableState.buffer;
        if (this.readableState.errored) {
            return { err: this.readableState.errored };
        } else if (readableQueue.length) {
            const chunk = readableQueue.shift()!;
            this.readableState.length -= this.objectMode ? 1 : (chunk as unknown as Uint8Array).byteLength;
            const res = { closed: false, chunk };
            if (readableQueue.length === 0 && this.readableState.ended) {
                this.readable.read(); //触发readable的对应事件
                res.closed = true;
            }
            return res;
        } else if (this.readableState.ended || this.readableState.closed) {
            this.readable.read(); //触发readable的 end close 事件
            return { closed: true };
        }
    }

    private queue(ctrl: ReadableStreamController<T>, chunk: T) {
        ctrl.enqueue(chunk);
    }
    private ctrlClosed = false;
    private waiting?: { resolve(chunk: T | undefined): void; reject(reason?: any): void };
    pull(ctrl: ReadableStreamController<T>) {
        const res = this.takeChunkFromReadableState();
        if (res) {
            if (res.chunk) this.queue(ctrl, res.chunk);

            if (res.err) ctrl.error(res.err);
            else if (res.closed) {
                ctrl.close();
                this.ctrlClosed = true;
            }
        } else {
            return new Promise<T | undefined>((resolve, reject) => {
                this.waiting = { resolve, reject };
            }).then(
                (chunk) => {
                    if (chunk) this.queue(ctrl, chunk);
                    else {
                        ctrl.close();
                        this.ctrlClosed = true;
                    }
                },
                (err) => ctrl.error(err)
            );
        }
    }
    /** cancel将销毁可读流 */
    cancel(reason?: unknown): void | PromiseLike<void> {
        this.readable.destroy(reason as any);
    }
    type: any;
}
interface ReadableStreamBYOBRequest {
    readonly view: ArrayBufferView | null;
    respond(bytesWritten: number): void;
    respondWithNewView(view: ArrayBufferView): void;
}

type WaitChunkRes<T> =
    | { err: unknown; closed?: undefined; chunk?: undefined }
    | { err?: undefined; closed: boolean; chunk?: T };

const fastArrayBuffer = Buffer.allocUnsafe(1).buffer;
/** 可读字节流chunk处理，避免将 node 的 Buffer 的底层 转移*/
function bytesQueueHandler(
    this: ReadableSource<ArrayBufferLike>,
    ctrl: ReadableByteStreamController,
    chunk: Uint8Array
) {
    if (chunk.buffer === fastArrayBuffer) {
        const buffer = new Uint8Array(chunk.byteLength);
        buffer.set(chunk);
        chunk = buffer;
    }
    const byobRequest = ctrl.byobRequest as unknown as ReadableStreamBYOBRequest | null;
    if (byobRequest) {
        byobRequest.respondWithNewView(chunk as any);
        byobRequest.respond(chunk.byteLength);
    } else {
        ctrl.enqueue(chunk);
    }
}
