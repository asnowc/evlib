import { Duplex } from "node:stream";
import {
    ReadableStream,
    ReadableStreamDefaultReader,
    ReadableWritablePair,
    StreamPipeOptions,
    WritableStream,
    WritableStreamDefaultWriter,
} from "node:stream/web";
import { readableToReadableStream, writableToWritableStream } from "./stream.js";

export class DuplexStream<T = unknown> {
    constructor(protected duplex: Duplex) {
        this.readableStream = readableToReadableStream(duplex);
        this.writableStream = writableToWritableStream(duplex);
    }
    private readableStream: ReadableStream<T>;
    private writableStream: WritableStream<T>;
    private reader: null | ReadableStreamDefaultReader<T> = null;
    private writer: null | WritableStreamDefaultWriter<T> = null;

    // readableStream

    get readableLocked(): boolean {
        return this.readableStream.locked;
    }
    getReader(): ReadableStreamDefaultReader<T> {
        const reader = this.readableStream.getReader();
        this.reader = reader;
        reader.closed.finally(() => (this.reader = null)).catch(() => {});
        return reader;
    }
    pipeThrough<R>(transform: ReadableWritablePair<R, T>, options?: StreamPipeOptions) {
        return this.readableStream.pipeThrough(transform, options);
    }
    pipeTo(target: WritableStream<T>, options?: StreamPipeOptions) {
        return this.readableStream.pipeTo(target, options);
    }
    tee() {
        return this.readableStream.tee();
    }

    // WritableStream

    get writableLocked(): boolean {
        return this.writableStream.locked;
    }
    /**
     * @remarks 关闭可写端 调用后 writable 变为 false
     */
    closeWritable(): Promise<void> {
        return this.writableStream.close();
    }
    getWriter(): WritableStreamDefaultWriter<T> {
        const writer = this.writableStream.getWriter();
        this.writer = writer;
        writer.closed.finally(() => (this.writer = null)).catch(() => {});
        return writer;
    }
    /**
     * @remarks 立即销毁流, 即使流被锁定
     *  相当于同时调用 ReadableStream.cancel() 和 WritableStream.abort()
     *  对于 node 的 duplex, 相当于调用 destroy()
     */
    async dispose(reason?: Error): Promise<void> {
        const reader = this.reader;
        const writer = this.writer;
        this.duplex.destroy(reason);
        if (reader && writer) return Promise.allSettled([reader, writer]).then(() => {});
        else if (reader) return reader.closed.finally();
        else if (writer) return writer.closed.finally();
    }

    get isAlive() {
        return this.duplex.writable || this.duplex.readable;
    }
    /** @remark 流可读，这意味着可以安全调用 readableStream 未关闭*/
    get readable() {
        return this.duplex.readable;
    }
    /** @remark 流可写，这意味着可以安全调用 writableStream 未关闭*/
    get writable() {
        return this.duplex.writable;
    }
}
