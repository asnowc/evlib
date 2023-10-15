import { Readable } from "node:stream";
import { StreamScanner } from "../scannable_stream.js";

/**
 * @public
 * @remarks 创建对 Readable 的 Scanner. 它不监听 readable 的 error 事件
 */
export function createScannerFromReadable<T extends Uint8Array = Buffer>(readable: Readable): StreamScanner<T> {
    readable.pause();

    const waitingQueue = new ReadingQueue();
    let closed: Error | undefined;

    function read(size: number): Promise<T>;
    function read(size: number, safe?: boolean): Promise<T | null>;
    function read(size: number, safe?: boolean): Promise<T | null> {
        return new Promise<unknown>(function (resolve, reject) {
            if (closed) return reject(closed);

            if (size > 0) {
                waitingQueue.push({ resolve, reject, size: size as any, safe: Boolean(safe) });
                onReadable();
            } else return reject(new Error("size must be greater than 0"));
        }) as Promise<T | null>;
    }
    function readTo<T extends ArrayBufferView>(view: T, safe?: boolean): Promise<T | null> {
        return new Promise<unknown>(function (resolve, reject) {
            if (closed) return reject(closed);
            if (!ArrayBuffer.isView(view)) throw new Error();

            waitingQueue.push({ resolve, reject, view, safe });
            onReadable();
        }) as Promise<T | null>;
    }
    function nextChunk(): Promise<T | null> {
        return new Promise<unknown>(function (resolve, reject) {
            if (closed) return resolve(null);
            waitingQueue.push({ resolve, reject, safe: true });
            onReadable();
        }) as Promise<T | null>;
    }

    function onReadable() {
        if (waitingQueue.checkQueue(readable)) onEnd(new Error("Stream no more data"));
    }
    function onEnd(reason: any) {
        closed = reason;
        readable.off("readable", onReadable);
        readable.off("close", onEnd);
        waitingQueue.rejectQueue(reason);
    }
    if (!readable.readableEnded) {
        readable.on("readable", onReadable); //监听数据变化, 包括push(null)
        readable.on("close", onEnd); // 监听destroy()
    }
    function cancel(reason?: any): null | T {
        onEnd(reason ?? new Error("Reader has be cancel"));
        return null;
    }

    return { cancel, read, readTo, nextChunk };
}

type WaitReaderHandle = {
    resolve(buf: Buffer | null | ArrayBufferView): void;
    reject(reason?: any): void;
    /** 如果不存在则读取一个chunk */
    size?: number;
    view?: ArrayBufferView;
    safe?: boolean;
};

/**
 * 读取队列,
 * 当数据更新时需要手动调用 checkQueue 更新队列状态
 */
class ReadingQueue {
    private queue: WaitReaderHandle[] = [];

    push(handle: WaitReaderHandle) {
        this.queue.push(handle);
    }
    /**
     * @remarks 检查 Readable的内部队列, 并解决等待队列
     * @returns 如果流不会再有更多数据, 则返回 true
     */
    checkQueue(readable: Readable) {
        const state = (readable as any)._readableState;
        const queue = this.queue;
        while (queue.length) {
            let handle = queue[0];
            if (!handle.size) {
                if (handle.view) {
                    if (state.length === handle.view.byteLength) {
                        //todo
                    } else if (state.length > handle.view.byteLength) {
                        //todo
                    } else return state.ended || !readable.readable;
                } else {
                    //读取一个chunk
                    const chunk = state.buffer.shift() as Uint8Array | undefined;
                    if (!chunk) return state.ended || !readable.readable;
                    state.length -= state.objectMode ? 1 : chunk.byteLength;
                    handle.resolve(chunk);
                    queue.shift();
                    if (!queue.length) readable.read(0); //调用以检测 readable 的各种事件
                }
            } else if (state.length >= handle.size) {
                handle.resolve(readable.read(handle.size)!);
                queue.shift();
            } else return state.ended || !readable.readable;
        }
    }

    rejectQueue(reason: Error) {
        let arr = this.queue;
        this.queue = [];
        for (let i = 0; i < arr.length; i++) {
            let item = arr[i];
            if (item.safe) item.resolve(null);
            else item.reject(reason);
        }
    }
}
