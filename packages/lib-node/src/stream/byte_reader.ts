/**
 * @public
 * @remarks 异步扫描器
 * @deprecated 将在2.0 移除
 */
export interface StreamScan {
  /** @remarks 读取指定长度，如果Stream不足该长度，则抛出异常 */
  (len: number): Promise<Uint8Array>;
  /** @remarks 安全读取指定长度，如果Stream不足该长度，则返回 null */
  (len: number, safe?: boolean): Promise<Uint8Array | null>;
}

/**
 * @public
 * @deprecated 将在2.0 移除
 */
export interface StreamBufferViewScan {
  /** @remarks 读取指定长度, 并写入到 view 中, 并返回 view 如果可读流的长度不足, 则抛出异常*/
  <T extends Uint8Array = Uint8Array>(view: T): Promise<T>;
  /** @remarks 读取指定长度, 并写入到 view 中, 如果 safe 为 true 在可读流的长度不足是则返回 null*/
  <T extends Uint8Array = Uint8Array>(view: T, safe?: boolean): Promise<T | null>;
}
/**
 * @public
 */
export interface ByteReader {
  /** @remarks 读取指定长度，如果Stream不足该长度，则抛出异常 */
  (len: number): Promise<Uint8Array>;
  /** @remarks 读取指定长度, 并写入到 view 中, 并返回 view 如果可读流的长度不足, 则抛出异常*/
  <T extends Uint8Array = Uint8Array>(view: T): Promise<T>;
  /**
   * @remarks 安全读取指定长度，如果Stream不足该长度，则返回 null
   * @deprecated 使用 `read().catch(()=>null)` 代替
   */
  (len: number, safe?: boolean): Promise<Uint8Array | null>;
  /**
   * @remarks 读取指定长度, 并写入到 view 中, 如果 safe 为 true 在可读流的长度不足是则返回 null
   * @deprecated 使用 `read().catch(()=>null)` 代替
   */
  <T extends Uint8Array = Uint8Array>(view: T, safe?: boolean): Promise<T | null>;
}
