import { Listenable } from "#evlib";
import { StreamPipeOptions } from "node:stream/web";

/** @public */
export interface WritableHandle<T> {
    write(chunk: T): Promise<void> | void;
    abort?(reason?: Error): void | Promise<void>;
    close?(): void | Promise<void>;
}

/**
 * @public
 * @remarks  read()、pipeTo()、迭代器返回的Promise可重复调用,
 */
export interface ByteReadable<T extends Uint8Array = Uint8Array> {
    /** @remarks 流的关闭事件 */
    $readableClosed: Listenable<Error | null>;
    /** @remarks 流是否已关闭 */
    readonly readableClosed: boolean;
    /**
     * @remarks 将数据源全部输入到 target, 当全部数据写入完成时 resolve。
     * 如果调用前 read() 读取的部分未解决, 则会等待它们全部解决, 然后开始迭代. 调用后将进入传输模式.
     */
    pipeTo(target: WritableHandle<T>, options?: StreamPipeOptions): Promise<void>;

    /** @remarks 读取下一个 chunk */
    read(): Promise<T | null>;
    /** @remarks 读取指定长度, 如因结束导致长度不足, 则抛出异常 */
    read(size: number): Promise<Uint8Array>;
    /** @remarks 读取指定长度, 如因结束导致的长度不足, 则返回 null */
    read(size: number, safe?: boolean): Promise<Uint8Array | null>;
    /** @remarks 读取并填充满 buffer. 如因结束导致长度不足, 则抛出异常 */
    read<R extends ArrayBufferView>(buffer: R): Promise<R>;
    /** @remarks 读取并填充满 buffer. 如因结束导致的长度不足, 则返回 null */
    read<R extends ArrayBufferView>(buffer: R, safe?: boolean): Promise<R | null>;

    /**
     * @remarks 取消可读流
     * 如果 reason 为 Error , 则会将 byteReadable 以异常中断. 否则, 这将是一个正常的结束信号
     */
    cancel(reason?: any): Promise<void>;

    /**
     * @remarks 异步迭代将数据源。
     * 如果调用前 read() 读取的部分未解决, 则会等待它们全部解决, 然后开始迭代. 调用后将进入传输模式.
     */
    [Symbol.asyncIterator](): AsyncGenerator<T>;
}

/** @public */
export interface ByteWritable<T extends Uint8Array = Uint8Array> {
    /** @remarks 流的关闭事件 */
    $writableClosed: Listenable<Error | null>;
    /** @remarks 流是否已关闭 */
    readonly writableClosed: boolean;
    readonly desiredSize: number | null;
    abort(reason?: Error): Promise<void>;
    /** @remarks 关闭流 */
    close(): Promise<void>;
    write(chunk: T): Promise<void>;
}
