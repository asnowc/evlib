/**
 * @public
 * @remarks 异步扫描器
 */
export interface StreamScan {
  /** @remarks 读取指定长度，如果Stream不足该长度，则抛出异常 */
  (len: number): Promise<Uint8Array>;
  /** @remarks 安全读取指定长度，如果Stream不足该长度，则返回 null */
  (len: number, safe?: boolean): Promise<Uint8Array | null>;
}

/**
 * @public
 */
export interface StreamBufferViewScan {
  /** @remarks 读取指定长度, 并写入到 view 中, 并返回 view 如果可读流的长度不足, 则抛出异常*/
  <T extends Uint8Array = Uint8Array>(view: T): Promise<T>;
  /** @remarks 读取指定长度, 并写入到 view 中, 如果 safe 为 true 在可读流的长度不足是则返回 null*/
  <T extends Uint8Array = Uint8Array>(view: T, safe?: boolean): Promise<T | null>;
}

/** @public */
export type ByteReader = StreamScan & StreamBufferViewScan;
