import { Readable, Writable } from "node:stream";
import {
  ReadableStream,
  WritableStream,
  QueuingStrategy,
  ByteLengthQueuingStrategy,
} from "node:stream/web";
import { ReadableSource } from "./transform/readable_core.js";
import { WritableCore } from "./transform/writable_core.js";
/**
 * @public
 * @remarks 将 node 的 Readable 转换为 ReadableStream
 * 它的行为与 Readable.toWeb() 的行为不同. Readable.toWeb() 会造成 扩大 highWaterMark 的问题. node v20 目前是这样的
 */
export function readableToReadableStream<T = Uint8Array>(
  readable: Readable,
): ReadableStream<T> {
  /** highWaterMark 由 readable 处理 */
  let queuingStrategy: QueuingStrategy = { highWaterMark: 0 };
  if (readable.readableObjectMode) {
    queuingStrategy.size = () => 1;
  } else {
    queuingStrategy.size = (chunk: ArrayBufferLike) => chunk.byteLength;
  }
  // bytes 不需要 size 函数
  // 另外 不支持可读字节流
  return new ReadableStream<T>(new ReadableSource(readable), queuingStrategy);
}
/**
 * @public
 * @remarks 将 node 的 Writable 转换为 WritableStream
 * 它的行为与 Writable.toWeb() 的行为不同.
 * 1. 当 write() 返回的 Promise 解决后, 说明数据已经被写入到底层. 而 Writable.toWeb() 的 write() 返回的 Promise 解决只是被写入到 Writable 的队列而已
 * 2. Writable.toWeb() 会造成 2 倍 highWaterMark. node v20 目前是这样的
 */
export function writableToWritableStream<T = Uint8Array>(writable: Writable) {
  let queuingStrategy: QueuingStrategy;
  if (writable.writableObjectMode) {
    queuingStrategy = {};
  } else {
    queuingStrategy = new ByteLengthQueuingStrategy({
      highWaterMark: writable.writableHighWaterMark,
    });
  }
  return new WritableStream<T>(new WritableCore(writable), queuingStrategy);
}
// function transformToTransformStream<T = Uint8Array>(transform: Transform) {
// return new TransformStream();
// }
