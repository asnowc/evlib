import { Listenable } from "#evlib";
import {
    WritableStream,
    ReadableStream,
    ReadableStreamDefaultReader,
    WritableStreamDefaultWriter,
    ReadableStreamDefaultReadResult,
} from "node:stream/web";
import { ByteReadableLockedError, AbstractByteReadable, WaitingQueue, resolveChunk } from "./abstract_byte_stream.js";
import { ByteWritable } from "./byte_stream.type.js";

export class ByteWebWritable<T extends Uint8Array = Uint8Array> implements ByteWritable<T> {
    constructor(stream: WritableStream) {
        const writer = stream.getWriter();
        this.#writer = writer;
        writer.closed
            .catch((reason) => reason)
            .then((err: Error | null = null) => {
                (this as any).closed = true;
                this.$writableClosed.emit(err);
            });
    }
    write(chunk: T): Promise<void> {
        return this.#writer.write(chunk);
    }
    #writer: WritableStreamDefaultWriter<T>;

    get desiredSize() {
        return this.#writer.desiredSize;
    }
    $writableClosed = new Listenable<Error | null>();
    readonly writableClosed: boolean = false;
    abort(reason?: Error) {
        return this.#writer.abort(reason);
    }
    close() {
        return this.#writer.close();
    }
}

export class ByteWebReadable<T extends Uint8Array = Uint8Array> extends AbstractByteReadable<T> {
    constructor(stream: ReadableStream) {
        super();
        this.#reader = stream.getReader();
        this.#reader.closed
            .catch((reason = new Error("readable stream error")) => {
                this.#errored = reason;
            })
            .then(() => {
                (this as any).readableClosed = true;
                if (this.#errored) this.rejectQueue(this.#errored);
                this.$readableClosed.emit(this.#errored!);
            });
    }
    #reader: ReadableStreamDefaultReader<T>;
    protected _residueChunk?: T;

    #queueing: WaitReaderHandle[] = [];
    readonly readableClosed: boolean = false;

    read<R extends ArrayBufferView>(buf_size?: number | R, safe?: boolean): Promise<T | R | null> {
        if (this.#errored) return Promise.reject(this.#errored);
        let wait!: WaitReaderHandle;
        const promise = new Promise<T | R | null>((resolve, reject) => {
            if (buf_size === undefined) {
                wait = { reject, resolve, safe: true } as any;
                return;
            } else {
                let buf: Uint8Array;
                let view: ArrayBufferView;
                if (typeof buf_size === "number") {
                    buf = new Uint8Array(buf_size);
                    view = buf;
                } else {
                    view = buf_size;
                    buf =
                        view instanceof Uint8Array
                            ? view
                            : new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
                }
                wait = {
                    reject,
                    resolve,
                    safe,
                    viewInfo: {
                        view,
                        buf,
                        offset: 0,
                        size: view.byteLength,
                    },
                } as any;
            }
        });
        if (wait.viewInfo?.size! <= 0) {
            wait.reject(new Error("byteLength must be greater than 1"));
            return promise;
        }
        wait.promise = promise;
        this.#queueing.push(wait);
        this.tick();
        return promise;
    }
    private async tick() {
        if (this.#transmitting) return;
        const list = this.#queueing;
        while (list[0]) {
            let res: ReadableStreamDefaultReadResult<T>;
            if (this._residueChunk) {
                this._residueChunk = resolveChunk(list, this._residueChunk);
            } else {
                res = await this.#reader.read();
                if (res.done) {
                    return this.rejectQueue(new Error("no more data"));
                }
                this._residueChunk = resolveChunk(list, res.value);
            }
        }
    }
    private rejectQueue(err: Error) {
        if (this.#errored) {
            for (const item of this.#queueing) {
                item.reject(this.#errored);
            }
        } else {
            for (const item of this.#queueing) {
                if (item.safe) item.resolve(null);
                else item.reject(err);
            }
        }
        this.#queueing.length = 0;
    }
    #errored?: Error;
    cancel(reason?: Error) {
        if (!this.#errored && reason instanceof Error) this.#errored = reason;
        return this.#reader.cancel(reason);
    }
    #transmitting = false;
    async *[Symbol.asyncIterator]() {
        if (this.#transmitting) throw new ByteReadableLockedError();
        if (this.#errored) throw this.#errored;
        this.#transmitting = true;
        if (this.#queueing.length) {
            await this.#queueing[this.#queueing.length - 1].promise;
        }
        if (this._residueChunk) {
            let chunk = this._residueChunk;
            this._residueChunk = undefined;
            yield chunk;
        }
        try {
            while (true) {
                let chunk = await this.#reader.read();
                if (chunk.done) {
                    if (this.#errored) throw this.#errored;
                    return;
                } else yield chunk.value;
            }
        } finally {
            this.#transmitting = false;
            this.tick();
        }
    }
}
type WaitReaderHandle = WaitingQueue & {
    promise: Promise<unknown>;
};
