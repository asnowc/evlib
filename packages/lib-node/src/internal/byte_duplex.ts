import { readableToByteReader, ByteReader, readableToReadableStream, writableToWritableStream } from "../stream.js";
import * as NodeStream from "node:stream";
import { createEvent, EventCenter } from "evlib";
import { ReadableStream, WritableStream } from "node:stream/web";

/**
 * @private
 * @remarks node Duplex 的变种
 * duplex end 事件会触发 DuplexStream.readable 的 close
 * duplex finished 事件会触发 DuplexStream.writable 的 close
 */
export class DuplexStream<T extends Uint8Array = Uint8Array> {
  constructor(protected duplex: NodeStream.Duplex) {
    this.read = readableToByteReader(duplex).read;
    duplex.on("close", () => {
      (this as any).closed = true;
      if (!this.writableClosed) {
        (this as any).writableClosed = true;
      }
      const err = this.duplex.errored;
      if (err) this.$closed.emitError(err);
      else this.$closed.emit();
    });
    this.readable = readableToReadableStream(duplex);
    this.writable = writableToWritableStream(duplex);
    this.writableClosed = !duplex.writable;
    this.closed = duplex.closed;
  }
  readonly readable: ReadableStream<T>;
  readonly writable: WritableStream<T>;

  $closed: EventCenter<void, Error> = createEvent();
  readonly closed: boolean;
  readonly writableClosed: boolean;

  get readableClosed() {
    return !this.duplex.readable;
  }
  get desiredSize() {
    return this.duplex.writableHighWaterMark - this.duplex.writableLength;
  }

  readonly read: ByteReader;

  /**
   * @remarks 结束写入
   */
  closeWrite(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.duplex.end(() => {
        (this as any).writableClosed = true;
        resolve();
      });
    });
  }
  write(chunk: T): Promise<void> {
    return new Promise((resolve, reject) => {
      this.duplex.write(chunk, (err) => (err ? reject(err) : resolve));
    });
  }

  /**
   * @remarks 销毁流
   */
  async dispose(reason?: Error): Promise<void> {
    this.duplex.destroy(reason);
  }
  [Symbol.asyncDispose]() {
    return this.dispose();
  }
}
