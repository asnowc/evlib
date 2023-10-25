import { ReadableStream, WritableStream } from "node:stream/web";
import { ByteWebReadable, ByteWebWritable } from "./byte_web_stream.js";
import { ByteReadable, ByteWritable } from "./byte_stream.type.js";

/** @public */
export function createByteReadable<T extends Uint8Array = Uint8Array>(readable: ReadableStream): ByteReadable<T> {
    return new ByteWebReadable(readable);
}

/** @public */
export function createByteWritable<T extends Uint8Array = Uint8Array>(writable: WritableStream): ByteWritable<T> {
    return new ByteWebWritable(writable);
}
