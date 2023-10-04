import { Readable } from "node:stream";
import { StreamScanner } from "../scannable_stream.js";

/**
 * @public
 * @remarks 创建对 Readable 的 Scanner
 */
export function createScannerFromReadable(readable: Readable): StreamScanner {
    readable.pause();

    let handles: WaitReaderHandle[] = [];

    function read(size: number): Promise<Buffer>;
    function read(size: number, safe: boolean): Promise<Buffer | null>;
    function read(size: number, safe?: boolean) {
        return new Promise<Buffer | null>(function (resolve, reject) {
            if (size <= 0) return reject(new Error("size must be greater than 0"));
            const handle = { resolve, reject, size, safe: Boolean(safe) };
            handles.push(handle);
            onReadable();
        });
    }

    function onReadable() {
        const state = (readable as any)._readableState;
        while (handles.length) {
            let handle = handles[0];
            if (state.length >= handle.size) {
                handle.resolve(readable.read(handle.size)!);
                handles.shift();
            } else if (!readable.readable || state.ended) {
                onEnd(new Error("Stream no more data"));
                break;
            } else break;
        }
    }
    function onEnd(reason?: any) {
        readable.off("readable", onReadable);
        readable.off("close", onEnd);

        let need = 0;
        for (let i = 0; i < handles.length; i++) {
            let item = handles[i];
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
        handles = [];
    }
    if (!readable.readableEnded) {
        readable.on("readable", onReadable);
        readable.on("close", onEnd);
    }
    function cancel(reason?: any): null | Buffer {
        onEnd(reason ?? new Error("Reader has be cancel"));
        return null;
    }

    return { cancel, read };
}

type WaitReaderHandle = {
    resolve(buf: Buffer | null): void;
    reject(reason?: any): void;
    size: number;
    safe?: boolean;
};