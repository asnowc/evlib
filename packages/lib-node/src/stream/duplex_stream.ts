import { Duplex } from "node:stream";
import { WritableStream } from "node:stream/web";
import { readableToScannableStream, writableToWritableStream } from "./stream_transform.js";
import { getStreamError, streamIsAlive } from "./stream_core.js";
import { Listenable } from "#evlib";
import { ScannableStream } from "./scannable_stream.js";

/**
 * @remarks node Duplex 的变种
 * @public
 */
export class DuplexStream<T> {
    constructor(protected duplex: Duplex) {
        this.readable = readableToScannableStream(duplex);
        this.writable = writableToWritableStream(duplex);
        duplex.on("close", () => this.$closed.emit(this.errored));
    }
    readonly readable: ScannableStream<T>;
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
    get [Symbol.asyncDispose]() {
        return this.duplex[Symbol.asyncDispose];
    }
}
