import type { Readable, Writable, Transform } from "node:stream";
import {
    ReadableStream,
    WritableStream,
    TransformStream,
    QueuingStrategy,
    ByteLengthQueuingStrategy,
    ReadableStreamDefaultReader,
} from "stream/web";
import { ReadableSource } from "./readable_core.js";
import { WritableCore } from "./writable_core.js";
import { ScannableStream, createScannerFromReadable } from "./scannable_stream.js";

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

/**
 * @remarks 创建对 Readable 的 ScannableStream
 */
export function readableToScannableStream<T>(readable: Readable): ScannableStream<T> {
    const stream = readableToReadableStream(readable) as ScannableStream<T>;
    let scannerLock: ReadableStreamDefaultReader | undefined;
    function getScanner() {
        scannerLock = stream.getReader();
        const ctrl = createScannerFromReadable(readable);
        const cancelHd = ctrl.cancel;
        ctrl.cancel = function cancel(reason?: any) {
            if (scannerLock) {
                scannerLock.releaseLock();
                scannerLock = undefined;
            }
            return cancelHd(reason);
        };
        return ctrl;
    }
    stream.getScanner = getScanner;
    return stream;
}

export * from "./duplex_core.js";
