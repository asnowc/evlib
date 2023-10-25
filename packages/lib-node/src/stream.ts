import { ReadableStreamDefaultReader } from "node:stream/web";

/**
 * @public
 * @remarks 读取流的所有内容
 */
export async function readAll<T>(reader: ReadableStreamDefaultReader<T>): Promise<T[]> {
    const list: T[] = [];
    do {
        const res = await reader.read();
        if (res.done) return list;
        list.push(res.value);
    } while (true);
}

export * from "./stream/byte_stream/mod.js";
export * from "./stream/byte_reader.js";
export * from "./stream/extra/mod.js";
export * from "./stream/stream_transform.js";
