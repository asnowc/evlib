import type { Readable } from "node:stream";
import type { InternalReadable, ReadableState } from "./stream_core.js";
import type { UnderlyingSource, ReadableStreamController, ReadableByteStreamController } from "node:stream/web";
/**
 * @remarks 读取流的一个chunk
 * @returns null: 流不会再有更多数据 undefined 没有 chunk
 */
export function takeChunkFromReadableState<T>(readableState: ReadableState<T>): T | undefined | null {
    const readableQueue = readableState.buffer;
    if (readableQueue.length) {
        const chunk = readableQueue.shift()!;
        readableState.length -= readableState.objectMode ? 1 : (chunk as unknown as Uint8Array).byteLength;
        return chunk;
    }

    return readableState.ended ? null : undefined;
}
/**
 * 将 readableState 中的数据移动到 info 中的缓冲区, 并移动偏移量.
 * 返回 undefined: 说明没有读取到chunk. view 没有发生变化
 * 返回 number: 填充满视图的缓冲区所需的字节长度
 */
export function setToBufferFromReadableState(
    info: BufferViewInfo,
    state: ReadableState<Uint8Array>
): number | undefined {
    const list = state.buffer;
    let node = list.head;
    if (!node) return;

    const buf = info.buf;

    do {
        let nodeSize = node.data.byteLength;
        if (nodeSize > info.size) {
            buf.set(node.data.subarray(0, info.size), info.offset);

            node.data = node.data.subarray(info.size);

            state.length -= info.size;
            info.offset += info.size;
            info.size = 0;

            break;
        } else {
            buf.set(node.data, info.offset);

            info.offset += nodeSize;
            info.size -= nodeSize;
            state.length -= nodeSize;
            node = node.next;
            list.length--;
        }
    } while (node);

    list.head = node;
    return buf.byteLength - info.offset;
}

export type BufferViewInfo = {
    view: ArrayBufferView;
    buf: Uint8Array;
    /** 偏移 */
    offset: number;
    /** 剩余长度 */
    size: number;
};

export class ReadableSource<T> implements UnderlyingSource {
    constructor(readable: Readable, type?: "bytes");
    constructor(private readable: InternalReadable<T>, type?: "bytes") {
        this.type = type;
        if (type === "bytes") {
            this.queue = bytesQueueHandler as any;
        }
        this.readableState = readable._readableState;
    }
    private readableState: ReadableState<T>;
    start(ctrl: ReadableStreamController<T>) {
        const readable = this.readable;
        if (readable.readableEnded) {
            ctrl.close();
            return;
        }
        if (!readable.readable) {
            ctrl.error(readable.errored ?? new Error("raw stream is unreadable"));
            return;
        }
        let closed = false;
        const tryClose = (error?: Error | null) => {
            //没有进行读取，但是流已经关闭
            if (!closed) {
                if (error) ctrl.error(error);
                else ctrl.close();
                closed = true;
            }
        };
        readable.on("close", () => {
            if (this.waiting) {
                this.waiting.reject();
                this.waiting = undefined;
            }
            tryClose(readable.errored);
        });
        readable.on("end", tryClose);

        readable.on("error", (err) => {
            ctrl.error(err);
        });

        //确保触发底层读取
        readable.on("readable", () => {
            if (this.waiting) {
                //理论上至少命中 readableState.length 或 readableState.ended
                const chunk = takeChunkFromReadableState(this.readableState);
                if (chunk) {
                    ctrl.enqueue(chunk);
                    this.waiting.resolve();
                    this.waiting = undefined;
                    this.readable.read(0);
                } else if (chunk === null) readable.read(0);
            } else if (readable.readableLength === 0) readable.read(0);
        });
    }

    private queue(ctrl: ReadableStreamController<T>, chunk: T) {
        ctrl.enqueue(chunk);
    }
    private waiting?: { resolve(): void; reject(reason?: any): void };
    pull(ctrl: ReadableStreamController<T>) {
        const chunk = takeChunkFromReadableState(this.readableState);
        if (chunk) {
            this.queue(ctrl, chunk);
            this.readable.read(0);
        } else {
            if (chunk === null) this.readable.read(0);
            return new Promise<void>((resolve, reject) => {
                this.waiting = { resolve, reject };
            });
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
