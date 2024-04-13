/**
 * @public
 */
export interface ByteReader {
  /** @remarks 读取指定长度，如果Stream不足该长度，则抛出异常 */
  (len: number): Promise<Uint8Array>;
  /** @remarks 读取指定长度, 并写入到 view 中, 并返回 view 如果可读流的长度不足, 则抛出异常*/
  <T extends Uint8Array = Uint8Array>(view: T): Promise<T>;
}
