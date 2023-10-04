import type { Readable } from "stream";
import { createScannerFromReadable } from "./create_scanner.js";

/**
 * @alpha
 * @remarks
 * 等待流达到len的长度时,读取流,然后返回
 *
 * @throws
 */
export async function readableRead(stream: Readable, len: number, abortSignal?: AbortSignal): Promise<Buffer> {
    if (stream.readableLength >= len) return stream.read(len);
    abortSignal?.throwIfAborted();

    const { read, cancel } = createScannerFromReadable<Buffer>(stream);
    function onTimeout() {
        cancel(abortSignal!.reason);
    }

    abortSignal?.addEventListener("abort", onTimeout);
    const buf = await read(len);
    abortSignal?.removeEventListener("abort", onTimeout);
    cancel();
    return buf;
}

/**
 * @alpha
 * @remarks 等待流 end 事件触发后一次性读取所有数据
 */
export async function readableReadAll(stream: Readable, abortSignal?: AbortSignal) {
    return new Promise<Buffer>(function (resolve, reject) {
        let dataList: Buffer[] = [];
        function onData(newData: Buffer) {
            dataList.push(newData);
        }
        function onEnd() {
            clear();
            resolve(Buffer.concat(dataList));
        }
        function onError() {
            clear();
            reject(new Error("wait aborted", { cause: { code: "ABORT_ERR" } }));
        }
        function onAbort() {
            clear();
            reject(abortSignal!.reason);
        }
        function clear() {
            stream.off("data", onData);
            stream.off("end", onEnd);
            stream.off("close", onError);
            abortSignal?.removeEventListener("abort", onAbort);
        }

        abortSignal?.addEventListener("abort", onAbort);
        stream.on("data", onData);
        stream.on("end", onEnd);
        stream.on("close", onError);
    });
}
