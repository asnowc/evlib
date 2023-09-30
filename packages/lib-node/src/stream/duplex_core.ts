import { Duplex } from "node:stream";
import { ReadableStream, WritableStream } from "node:stream/web";
import { readableToReadableStream, writableToWritableStream } from "./stream.js";
import { getStreamError, streamIsAlive } from "./stream_core.js";
import { Listenable } from "#evlib";

/**
 * @remarks node Duplex 的变种
 * @public
 */
export class DuplexStream<T = unknown> {
    constructor(protected duplex: Duplex) {
        this.readable = readableToReadableStream(duplex);
        this.writable = writableToWritableStream(duplex);
        duplex.on("close", () => this.$closed.emit(this.errored));
    }
    readonly readable: ReadableStream<T>;
    readonly writable: WritableStream<T>;

    dispose(reason?: any) {
        this.duplex.destroy(reason);
    }
    /**
     * @remarks 流的关闭事件
     */
    $closed = new Listenable<Error | null>();
    /**
     * @remarks 流是否已因异常关闭
     */
    get errored() {
        return getStreamError(this.duplex);
    }
    /**
     * @remarks 流是否已关闭
     */
    get closed() {
        return !streamIsAlive(this.duplex);
    }
    /** @remark readableStream 是否已关闭*/
    get readableClosed() {
        return !this.duplex.readable;
    }
    /** @remark writableStream 是否已关闭*/
    get writableClosed() {
        return !this.duplex.writable;
    }
}
