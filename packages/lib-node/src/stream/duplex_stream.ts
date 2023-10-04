import { Duplex } from "node:stream";
import { Listenable } from "#evlib";

/**
 * @beta
 * @remarks node Duplex 的变种
 * @deprecated 不建议使用
 * todo 待完成
 */
export class DuplexStream<T extends Uint8Array> {
    constructor(protected duplex: Duplex) {
        duplex.on("close", () => this.$closed.emit(duplex.errored));
    }
    dispose(reason?: any) {
        this.duplex.destroy(reason);
    }
    /**
     * @remarks 流的关闭事件
     */
    $closed = new Listenable<Error | null>();
    /** @remarks 流是否已关闭 */
    get closed() {
        return this.duplex.closed;
    }
    /** @remarks 流是否因异常关闭 */
    get errored() {
        return this.duplex.errored;
    }

    get readable() {
        return this.duplex.readable;
    }
    get writable() {
        return this.duplex.writable;
    }
    get [Symbol.asyncDispose]() {
        return this.duplex[Symbol.asyncDispose];
    }
}
