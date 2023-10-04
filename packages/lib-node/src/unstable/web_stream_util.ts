import { ReadableStream } from "node:stream/web";
import { StreamScanner } from "../stream/scannable_stream.js";

/**
 * @alpha
 * @remarks 创建对 Readable 的 StreamScanner
 */
export function createReaderFromWebStream(stream: ReadableStream<Uint8Array>): StreamScanner<Uint8Array> {
    type T = Uint8Array;
    const readable = stream.getReader();

    let ended = false;
    const cache = new Cache();

    function read(size: number): Promise<T>;
    function read(size: number, safe?: boolean): Promise<T | null>;
    function read(size: number, safe?: boolean): Promise<T | null> {
        return new Promise<T | null>(function (resolve, reject) {
            if (size > 0) {
                if (cache.handles.length === 0) {
                    const buf = cache.tryRead(size);
                    if (buf) return resolve(buf);
                    else if (ended) {
                        if (safe) resolve(null);
                        else reject(new Error("Stream is ended"));
                        return;
                    }
                }
                cache.push({ resolve, reject, size, safe: Boolean(safe) });
                readNext();
            } else throw new Error("size must be greater than 0");
        });
    }
    function nextChunk(): Promise<T | null> {
        return new Promise(function (resolve, reject) {
            //todo
            throw new Error("method not implemented");
        });
    }
    function readTo<R extends ArrayBufferView>(view: R, safe?: boolean): Promise<T | null> {
        return new Promise(function (resolve, reject) {
            //todo
            throw new Error("method not implemented");
        });
    }

    async function readNext() {
        while (cache.handles.length) {
            const res = await readable.read();
            if (res.done) return onEnd();
            cache.addCache(res.value);
        }
    }
    function onEnd(reason?: any) {
        ended = true;

        let need = cache.cacheTotal;
        for (let i = 0; i < cache.handles.length; i++) {
            let item = cache.handles[i];
            if (item.safe) item.resolve(null);
            else {
                let err = reason;
                if (err === undefined) {
                    err = new Error(
                        `Stream has ended. ${item.size} bytes need to be read and ${
                            item.size - need
                        } bytes need to be entered`
                    );
                }
                item.reject(err);
            }
            need -= item.size;
        }
        cache.handles = [];
    }

    function cancel(reason?: any): null | T {
        onEnd(reason ?? new Error("Reader has be cancel"));
        return cache.cancelCache();
    }

    return { cancel, read, readTo, nextChunk };
}
type Q = Uint8Array;
class Cache {
    cacheTotal = 0;
    private cache: Q[] = [];
    handles: WaitReaderHandle<Q>[] = [];
    push(item: WaitReaderHandle<Q>) {
        this.handles.push(item);
    }
    addCache(item: Q) {
        this.cache.push(item);
        this.cacheTotal += item.byteLength;

        if (this.cacheTotal >= this.handles[0].size) {
            const item = this.handles.shift()!;
            const buf = this.concatBufferList(item.size) as any;
            item.resolve(buf);
        }
    }
    /**
     * 从 bufList读取 size 长度的 Uint8Array,
     * bufList 中已读取的部分会被移除
     * 如果bufList中的buffer总长度小于size，则用0填充
     */
    private concatBufferList(size: number) {
        const bufList = this.cache;
        if (size === bufList[0].byteLength) return bufList.shift()!;

        const buf = new Uint8Array(size);
        let offset = 0;
        for (let i = 0; i < bufList.length; i++) {
            let chunk = bufList[i];
            let overlength = size - offset;
            if (overlength < chunk.byteLength) {
                buf.set(chunk.subarray(0, overlength));
                bufList[i] = chunk.subarray(overlength) as Q;
                bufList.splice(0, i - 1);
                return buf;
            } else if (overlength === chunk.byteLength) {
                buf.set(chunk, offset);
                bufList.splice(0, i);
                return buf;
            } else {
                buf.set(chunk, offset);
                offset += chunk.byteLength;
            }
        }
        while (offset < size) buf[offset++] = 0;
        this.cacheTotal -= size;
        return buf;
    }
    tryRead(size: number) {
        if (this.cacheTotal >= size) {
            const buf = this.concatBufferList(size);
            return buf;
        }
        return null;
    }
    cancelCache(): Q | null {
        const cache = this.cache;
        const cacheTotal = this.cacheTotal;
        let buf: null | Q = null;
        if (cache.length === 1) {
            buf = cache[0];
            this.cache = [];
        } else if (cache.length) {
            buf = new Uint8Array(cacheTotal);
            let offset = 0;
            for (let i = 0; i < cache.length; i++) {
                buf.set(cache[i], offset);
                offset += cache[i].length;
            }
            this.cache = [];
        }
        return buf;
    }
}

type WaitReaderHandle<T> = {
    resolve(buf: T | null): void;
    reject(reason?: any): void;
    size: number;
    safe?: boolean;
};
