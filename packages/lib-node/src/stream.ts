import { ReadableStream } from "node:stream/web";

/**
 * @public
 * @remarks 读取流的所有内容
 */
export async function readAllFromStream<T>(stream: ReadableStream<T>): Promise<T[]> {
  const list: T[] = [];
  for await (const chunk of stream) {
    list.push(chunk);
  }
  return list;
}

export * from "./stream/byte_reader.js";
export * from "./stream/extra/mod.js";
export * from "./stream/stream_transform.js";
