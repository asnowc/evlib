import type { Readable, Writable, Transform } from "node:stream";
import {
    ReadableStream,
    WritableStream,
    TransformStream,
    QueuingStrategy,
    ByteLengthQueuingStrategy,
} from "stream/web";
import { ReadableSource } from "./readable_core.js";
import { WritableCore } from "./writable_core.js";

export function readableToReadableStream<T = Uint8Array>(
    readable: Readable,
    option: { type?: "bytes" } = {}
): ReadableStream<T> {
    const { type } = option;
    readable.pause();

    /** highWaterMark 由 readable 处理 */
    let queuingStrategy: QueuingStrategy = { highWaterMark: 0 };
    if (readable.readableObjectMode) {
        queuingStrategy.size = () => 1;
    } else if (type !== "bytes") {
        queuingStrategy.size = (chunk: ArrayBufferLike) => chunk.byteLength;
    }
    // bytes 不需要 size 函数
    return new ReadableStream<T>(new ReadableSource(readable, type), queuingStrategy);
}
export function writableToWritableStream<T = Uint8Array>(writable: Writable) {
    let queuingStrategy: QueuingStrategy;
    if (writable.writableObjectMode) {
        queuingStrategy = {};
    } else {
        queuingStrategy = new ByteLengthQueuingStrategy({ highWaterMark: writable.writableHighWaterMark });
    }
    return new WritableStream<T>(new WritableCore(writable), queuingStrategy);
}
// function transformToTransformStream<T = Uint8Array>(transform: Transform) {
// return new TransformStream();
// }
