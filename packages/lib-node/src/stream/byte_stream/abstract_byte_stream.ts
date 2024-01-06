import { WritableHandle, ByteReadable } from "./byte_stream.type.js";
import { Listenable } from "evlib";
import { BufferViewInfo } from "../transform/readable_core.js";

interface StreamPipeOptions {
    preventAbort?: boolean;
    preventCancel?: boolean;
    preventClose?: boolean;
    signal?: AbortSignal;
}
export abstract class AbstractByteReadable<T extends Uint8Array> implements ByteReadable<T> {
    abstract readonly readableClosed: boolean;
    protected abstract _residueChunk?: T;
    $readableClosed = new Listenable<Error | null>();
    async pipeTo<R extends WritableHandle<T>>(target: R, options: StreamPipeOptions = {}): Promise<void> {
        const { preventAbort, preventCancel, preventClose, signal } = options;
        let writable = target;

        let aborted: Error | undefined;
        const onAbort = () => {
            aborted = signal!.reason ?? new Error("aborted");
            if (!preventCancel) this.cancel(aborted);
        };
        let chunk: T | undefined;
        try {
            if (signal) {
                signal.throwIfAborted();
                signal.addEventListener("abort", onAbort);
            }
            for await (chunk of this) {
                if (aborted !== undefined) throw aborted;
                await writable.write(chunk);
            }
            chunk = undefined;
        } catch (err) {
            this._residueChunk = chunk;
            if (!preventAbort) writable.abort?.(err as Error);
            if (!preventCancel) this.cancel(err as Error);
            throw err;
        } finally {
            signal?.removeEventListener("abort", onAbort);
        }
        if (!preventClose) return writable.close?.();
    }
    abstract read(): Promise<T | null>;
    abstract read<R extends Uint8Array>(buffer: R): Promise<R>;

    abstract cancel(reason?: Error): Promise<void>;
    abstract [Symbol.asyncIterator](): AsyncGenerator<T>;
}

export class ByteWritableLockedError extends Error {
    constructor() {
        super("Writable is locked");
    }
}
export class ByteReadableLockedError extends Error {
    constructor() {
        super("Readable is locked");
    }
}
export type WaitingQueue = {
    resolve(buf: null | unknown): void;
    reject(reason?: any): void;
    safe?: boolean;
    viewInfo?: BufferViewInfo;
};

export function resolveChunk<T extends Uint8Array>(list: WaitingQueue[], chunk: T): T | undefined {
    let head = list[0];
    let residueChunk: T | undefined;
    const viewInfo = head.viewInfo;
    if (!viewInfo) {
        head.resolve(chunk);
        list.shift();

        head = list[0];
    } else {
        if (chunk.byteLength > viewInfo.size) {
            viewInfo.buf.set(chunk.subarray(0, viewInfo.size), viewInfo.offset);
            residueChunk = chunk.subarray(viewInfo.size) as T;
            viewInfo.offset += viewInfo.size;
            viewInfo.size = 0;
        } else {
            viewInfo.buf.set(chunk, viewInfo.offset);
            viewInfo.offset += chunk.byteLength;
            viewInfo.size -= chunk.byteLength;
        }
        if (viewInfo.size === 0) {
            list.shift();
            head.resolve(viewInfo.view);
            head = list[0];
        }
    }
    return residueChunk;
}
