import { ReadableStream } from "node:stream/web";

/** 读取流的所有内容
 * @public
 */
export async function readAllFromStream<T>(
  stream: ReadableStream<T>
): Promise<T[]> {
  const list: T[] = [];
  for await (const chunk of stream) {
    list.push(chunk);
  }
  return list;
}

export * from "./stream/byte_reader.ts";
export * from "./stream/extra/mod.ts";
export * from "./stream/stream_transform.ts";
