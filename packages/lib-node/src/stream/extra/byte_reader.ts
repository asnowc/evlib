import { Readable } from "node:stream";
import type { ByteReader } from "../byte_reader.js";
import { setToBufferFromReadableState, takeChunkFromReadableState } from "../transform/readable_core.js";
import { ReadableStream, ReadableStreamDefaultReadResult } from "node:stream/web";
import { resolveChunk, WaitingQueue } from "../byte_stream/abstract_byte_stream.js";

/**
 * @alpha
 * @remarks 创建对 Readable 的 StreamScanner
 */
export function createByteReaderFromWebStream<T extends Uint8Array>(
    stream: ReadableStream<T>
): { read: ByteReader<T>; cancel(reason?: Error): T | null } {
    const readable = stream.getReader();

    let ended = false;
    let errored: Error | undefined;
    let residueChunk: T | undefined;
    const queue: WaitingQueue[] = [];

    function read(): Promise<null | T>;
    function read(size: number): Promise<Uint8Array>;
    function read(size: number, safe?: boolean): Promise<Uint8Array | null>;
    function read<P extends ArrayBufferView>(size: P): Promise<P | null>;
    function read<P extends ArrayBufferView>(size: P, safe?: boolean): Promise<P | null>;
    function read<P extends ArrayBufferView>(
        view?: number | Uint8Array | P,
        safe?: boolean
    ): Promise<Uint8Array | P | null> {
        if (ended) {
            if (view === undefined || safe) Promise.resolve(null);
            else Promise.reject(errored);
        }
        if (errored) Promise.reject(errored);

        return new Promise<P | Uint8Array | null>(function (resolve, reject) {
            if (view === undefined) {
                queue.push({ resolve, reject, safe: true });
                return;
            }
            let buf: Uint8Array;
            if (typeof view === "number") {
                if (view > 0) {
                    buf = new Uint8Array(view);
                    view = buf;
                } else throw new Error("size must be greater than 0");
            } else {
                buf = view instanceof Uint8Array ? view : new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
            }
            queue.push({ resolve, reject, safe, viewInfo: { buf, view, offset: 0, size: view.byteLength } });
            readNext();
        });
    }

    async function readNext() {
        while (queue[0]) {
            let res: ReadableStreamDefaultReadResult<T>;
            if (residueChunk) {
                residueChunk = resolveChunk(queue, residueChunk);
            } else {
                res = await readable.read();
                if (res.done) {
                    ended = true;
                    return cancel(new Error("no more data"));
                }
                residueChunk = resolveChunk(queue, res.value);
            }
        }
    }

    function cancel(reason = new Error("Reader has be cancel")): null | T {
        if (errored) {
            for (const item of queue) {
                item.reject(errored);
            }
        } else {
            errored = reason;
            for (const item of queue) {
                if (item.safe) item.resolve(null);
                else item.reject(reason);
            }
        }
        queue.length = 0;
        return residueChunk ?? null;
    }

    return { cancel, read };
}

/**
 * @public
 * @remarks 创建对 Readable 的 Scanner. 它不监听 readable 的 error 事件
 */
export function createByteReaderFromReadable<T extends Uint8Array = Uint8Array>(
    readable: Readable
): { read: ByteReader<T>; cancel(reason?: Error): null } {
    readable.pause();
    const waitingQueue: WaitingQueue[] = [];
    let closed: Error | undefined;

    function read(): Promise<T | null>;
    function read(size: number): Promise<T>;
    function read(size: number, safe?: boolean): Promise<T | null>;
    function read<R extends ArrayBufferView>(view: R): Promise<R>;
    function read<R extends ArrayBufferView>(view: R, safe?: boolean): Promise<R | null>;
    function read(view?: number | ArrayBufferView, safe?: boolean): Promise<T | null> {
        return new Promise<unknown>(function (resolve, reject) {
            const item: WaitingQueue = { resolve, reject };

            if (view === undefined) {
                item.safe = true;
            } else if (typeof view === "number") {
                if (view <= 0) return reject(new Error("size must be greater than 0"));
                item.safe = Boolean(safe);
                const rawView = new Uint8Array(view);
                item.viewInfo = {
                    view: rawView,
                    buf: rawView,
                    offset: 0,
                    size: view,
                };
            } else if (ArrayBuffer.isView(view)) {
                if (view.byteLength <= 0) return reject(new Error("buffer view length must be greater than 0"));
                item.safe = Boolean(safe);
                const buf =
                    view instanceof Uint8Array ? view : new Uint8Array(view.buffer, view.byteOffset, view.byteLength);

                item.viewInfo = {
                    buf,
                    view,
                    offset: 0,
                    size: view.byteLength,
                };
            } else {
                return reject(
                    new Error(
                        "Parameter 1 should be of type undefined, number, or a ArrayBufferView. Actual:" + typeof view
                    )
                );
            }

            if (closed) return safe ? resolve(null) : reject(closed);
            waitingQueue.push(item);
            onReadable();
        }) as Promise<T | null>;
    }

    function onReadable() {
        if (checkQueue(waitingQueue, readable)) onEnd(new Error("Stream no more data"));
    }
    function onEnd(reason: any) {
        closed = reason;
        readable.off("readable", onReadable);
        readable.off("close", onEnd);
        rejectQueue(waitingQueue, reason);
    }
    if (!readable.readableEnded) {
        readable.on("readable", onReadable); //监听数据变化, 包括push(null)
        readable.on("close", onEnd); // 监听destroy()
    }
    function cancel(reason?: any): null {
        onEnd(reason ?? new Error("Reader has be cancel"));
        return null;
    }

    return { cancel, read };
}

/**
 *
 * @remarks 迭代 readable 的 chunk.
 */
function iterateReadable<T>(readable: Readable): AsyncIterableIterator<T> {
    if (readable.readableEnded) return finItr();
    if (readable.closed) return finItr(readable.errored ?? new Error("raw stream closed"));

    let result: IteratorResult<T> | undefined; //如果不是 undefined 则流已结束
    let errored: any;
    const { cancel, read } = createByteReaderFromReadable<any>(readable);

    function onError() {}
    readable.on("error", onError);

    function next(): Promise<IteratorResult<T>> {
        if (result) return Promise.resolve(result);
        if (errored !== undefined) return Promise.reject(errored);
        return read().then((chunk) => {
            if (chunk === null) return ret();
            return { done: false, value: chunk };
        });
    }
    function ret(): Promise<IteratorResult<T>> {
        if (result) return Promise.resolve(result);
        if (errored !== undefined) return Promise.reject(errored);
        result = { value: undefined, done: true };
        cancel();
        readable.off("error", onError);
        return Promise.resolve(result);
    }

    return {
        [Symbol.asyncIterator]() {
            return this;
        },
        next,
        return: ret,
    };
}

function finItr(err?: Error): AsyncIterableIterator<any> {
    function rej(): Promise<IteratorResult<any>> {
        return Promise.reject(err);
    }
    function res(): Promise<IteratorResult<any>> {
        return Promise.resolve({ done: true, value: undefined });
    }
    const next = err ? rej : res;
    return {
        next,
        return: next,
        [Symbol.asyncIterator]() {
            return this;
        },
    };
}

/**
 * @remarks 检查 Readable的内部队列, 并解决等待队列
 * @returns 如果流不会再有更多数据, 则返回 true
 */
function checkQueue(queue: WaitingQueue[], readable: Readable) {
    const state = (readable as any)._readableState;

    while (queue.length) {
        let handle = queue[0];
        const viewInfo = handle.viewInfo;
        if (!viewInfo) {
            const chunk = takeChunkFromReadableState(state);
            if (chunk) handle.resolve(chunk);
            else return chunk === null;
        } else {
            const stillNeedLen = setToBufferFromReadableState(viewInfo, state);
            if (stillNeedLen === undefined) return state.ended || state.closed;
            readable.read(0);
            if (stillNeedLen > 0) return state.ended || state.closed;
            handle.resolve(viewInfo.view);
        }
        queue.shift();
    }
    readable.read(0); //调用以检测 readable 的各种事件
}
function rejectQueue(queue: WaitingQueue[], reason: Error) {
    for (let i = 0; i < queue.length; i++) {
        let item = queue[i];
        if (item.safe) item.resolve(null);
        else item.reject(reason);
    }
}
