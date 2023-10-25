import { Readable } from "node:stream";
import { createByteReaderFromReadable } from "../extra/byte_reader.js";
import type { StreamBufferViewScan, StreamScan } from "../byte_reader.js";

/**
 * @public
 * @remarks 创建对 Readable 的 Scanner. 它不监听 readable 的 error 事件
 * @deprecated 改用 createByteReaderFromReadable()
 */
export function createScannerFromReadable<T extends Buffer = Buffer>(readable: Readable): StreamScanner<Buffer> {
    const { cancel, read } = createByteReaderFromReadable<Buffer>(readable);
    function readTo<T extends ArrayBufferView>(view: T): Promise<T> {
        if (!ArrayBuffer.isView(view)) throw new Error("view must be ArrayBuffer view");
        return read(view);
    }
    function scan(size: number): Promise<Buffer>;
    function scan(size: number, safe?: boolean): Promise<Buffer | null>;
    function scan(size: number, safe?: boolean): Promise<Buffer | null> {
        if (size <= 0) return Promise.reject(new Error("size must be greater than 0"));
        return read(Buffer.allocUnsafe(size), safe);
    }
    return {
        cancel,
        read: scan,
        readTo,
        nextChunk: () => read(),
    };
}
/**
 * @public
 * @deprecated 已废弃
 */
export type StreamScanner<T extends Uint8Array = Uint8Array> = {
    read: StreamScan<T>;
    /** @deprecated 改用 read(view) */
    readTo: StreamBufferViewScan;
    /** @deprecated 改用 read() */
    nextChunk(): Promise<T | null>;
    /**
     * @remarks 取消对流的扫描。
     * 取消时如果流已经发出end事件，并且未完全扫描所有chunk则返回剩余未扫描的部分
     */
    cancel(reason?: any): null | T;
};
