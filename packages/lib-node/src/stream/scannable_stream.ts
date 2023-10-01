import { ReadableStream } from "node:stream/web";
import type { Readable } from "node:stream";

/**
 * @public
 * @remarks 异步扫描器
 */
export interface StreamScan<T = Buffer> {
    /** @remarks 读取指定长度，如果Stream不足该长度，则抛出异常 */
    (len: number): Promise<T>;
    /** @remarks 安全读取指定长度，如果Stream不足该长度，则返回 null */
    (len: number, safe: boolean): Promise<T | null>;
}
/**
 * @public
 */
export type StreamScanner<T = Buffer> = {
    read: StreamScan<T>;

    /**
     * @remarks 取消对流的扫描。
     * 取消时如果流已经发出end事件，并且未完全扫描所有chunk则返回剩余未扫描的部分
     */
    cancel(reason?: any): null | T;
};

/**
 * @public
 */
export interface ScannableStream<T> extends ReadableStream<T> {
    getScanner(): StreamScanner;
}
