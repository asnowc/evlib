import { ReadableStream } from "node:stream/web";

/**
 * @public
 * @remarks 异步扫描器
 */
export interface StreamScan<T extends Uint8Array = Uint8Array> {
    /** @remarks 读取指定长度，如果Stream不足该长度，则抛出异常 */
    (len: number): Promise<T>;
    /** @remarks 安全读取指定长度，如果Stream不足该长度，则返回 null */
    (len: number, safe?: boolean): Promise<T | null>;
}
/**
 * @public
 */
export interface StreamBufferViewScan {
    /** @remarks 读取指定长度, 并写入到 view 中, 并返回 view 如果可读流的长度不足, 则抛出异常*/
    <P extends ArrayBufferView>(view: P): Promise<P>;
    /** @remarks 读取指定长度, 并写入到 view 中, 并返回 view, 如果可读流的长度不足, 则返回null */
    <P extends ArrayBufferView>(view: P, safe?: boolean): Promise<P | null>;
}

/**
 * @public
 */
export type StreamScanner<T extends Uint8Array = Uint8Array> = {
    read: StreamScan<T>;
    readTo: StreamBufferViewScan;
    nextChunk(): Promise<T | null>;
    /**
     * @remarks 取消对流的扫描。
     * 取消时如果流已经发出end事件，并且未完全扫描所有chunk则返回剩余未扫描的部分
     */
    cancel(reason?: any): null | T;
};

/**
 * @public
 */
export interface ScannableStream<T extends Uint8Array = Uint8Array> extends ReadableStream<T> {
    getScanner(): StreamScanner<T>;
}
