import { ByteWritable } from "../stream/byte_stream/mod.js";
import { ByteWebReadable } from "../stream/byte_stream/byte_web_stream.js";
import * as NodeStream from "node:stream";
import { readableToReadableStream } from "../stream/stream_transform.js";
import { Listenable } from "evlib";

/**
 * @private
 * @remarks node Duplex 的变种
 * duplex end 事件会触发 DuplexStream.readable 的 close
 * duplex finished 事件会触发 DuplexStream.writable 的 close
 */
export class DuplexStream<T extends Uint8Array = Uint8Array> extends ByteWebReadable<T> implements ByteWritable<T> {
    constructor(protected duplex: NodeStream.Duplex) {
        super(readableToReadableStream(duplex));
        duplex.on("close", () => {
            (this as any).closed = true;
            if (!this.writableClosed) {
                (this as any).writableClosed = true;
                this.$writableClosed.emit(this.duplex.errored);
            }
            // todo: 优化
            // 这里等待两个微任务后触发. 确保 writable 和 readable 的 $closed 触发
            queueMicrotask(() => {
                queueMicrotask(() => {
                    this.$closed.emit(this.duplex.errored);
                });
            });
        });
    }

    cancel(reason?: Error | undefined): Promise<void> {
        return super.cancel(reason);
    }

    $writableClosed = new Listenable<Error | null>();
    readonly writableClosed = false;
    get desiredSize() {
        return this.duplex.writableHighWaterMark - this.duplex.writableLength;
    }
    abort(reason?: Error | undefined): Promise<void> {
        return Promise.resolve(this.dispose(reason));
    }
    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.duplex.end(() => {
                resolve();
                (this as any).writableClosed = true;
                this.$writableClosed.emit(null);
            });
        });
    }
    write(chunk: T): Promise<void> {
        return new Promise((resolve, reject) => {
            this.duplex.write(chunk, (err) => (err ? reject(err) : resolve));
        });
    }

    $closed = new Listenable<Error | null>();
    readonly closed = false;
    dispose(reason?: Error) {
        this.duplex.destroy(reason);
    }
    [Symbol.asyncDispose]() {
        return this.dispose();
    }
}
