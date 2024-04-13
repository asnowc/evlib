import { Readable } from "node:stream";
import { readableToByteReader } from "../extra/byte_reader.js";

/**
 * @public
 * @remarks 创建对 Readable 的 Scanner. 它不监听 readable 的 error 事件
 * @deprecated 改用 createByteReaderFromReadable()
 */
export function createScannerFromReadable<T extends Buffer = Buffer>(
  readable: Readable,
): StreamScanner<Buffer> {
  const { cancel, read } = readableToByteReader(readable);
  function readTo<T extends ArrayBufferView>(view: T): Promise<T> {
    if (!ArrayBuffer.isView(view))
      throw new Error("view must be ArrayBuffer view");
    if (view instanceof Uint8Array) return read(view);
    const buf = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    return read(buf).then(() => view);
  }
  const read2 = function read2(len: number, safe?: boolean) {
    if (safe) return read(Buffer.allocUnsafe(len)).catch(() => null);
    return read(Buffer.allocUnsafe(len));
  } as StreamScanner<Buffer>["read"];
  return {
    cancel,
    read: read2,
    readTo,
    nextChunk: () => read2(1),
  };
}
/**
 * @public
 * @deprecated 已废弃
 */
export type StreamScanner<T extends Uint8Array = Uint8Array> = {
  read: {
    (len: number): Promise<T>;
    (len: number, safe?: boolean): Promise<T | null>;
  };
  /** @deprecated 改用 read(view) */
  readTo: {
    <T extends ArrayBufferView>(view: T): Promise<T>;
  };
  /** @deprecated 改用 read() */
  nextChunk(): Promise<T | null>;
  /**
   * @remarks 取消对流的扫描。
   * 取消时如果流已经发出end事件，并且未完全扫描所有chunk则返回剩余未扫描的部分
   */
  cancel(reason?: any): null | T;
};
