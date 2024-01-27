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
  <P extends Uint8Array>(view: P): Promise<P>;
  /**
   * @deprecated
   * @remarks 读取指定长度, 并写入到 view 中, 并返回 view 如果可读流的长度不足, 则抛出异常*/
  <P extends ArrayBufferView>(view: P): Promise<P>;
  /**
   * @deprecated
   * @remarks 读取指定长度, 并写入到 view 中. 如果 safe 为 true 在可读流的长度不足是则返回 null*/
  <P extends ArrayBufferView>(view: P, safe?: boolean): Promise<P | null>;
}

/** @public */
export interface ByteReader<T extends Uint8Array = Uint8Array> extends StreamBufferViewScan {
  /** 读取一个 chunk */
  (): Promise<T | null>;
  /** @remarks 读取指定长度，如果Stream不足该长度，则抛出异常 */
  (len: number): Promise<Uint8Array>;
  /** @remarks 安全读取指定长度，如果Stream不足该长度，则返回 null */
  (len: number, safe?: boolean): Promise<Uint8Array | null>;
}
