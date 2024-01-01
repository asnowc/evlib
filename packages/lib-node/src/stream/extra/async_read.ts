import type { Readable } from "stream";
import { createByteReaderFromReadable } from "./byte_reader.js";

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

  const { read, cancel } = createByteReaderFromReadable(stream);
  function onTimeout() {
    cancel(abortSignal!.reason);
  }

  abortSignal?.addEventListener("abort", onTimeout);
  return read(len).finally(function () {
    abortSignal?.removeEventListener("abort", onTimeout);
    cancel();
  });
}

/**
 * @alpha
 * @remarks 读取所有 chunks. 等待流 end 事件触发后解决
 */
export async function readableReadAll<T>(stream: Readable, abortSignal?: AbortSignal) {
  return new Promise<T[]>(function (resolve, reject) {
    let dataList: T[] = [];
    function onData(newData: T) {
      dataList.push(newData);
    }
    function onEnd() {
      clear();
      resolve(dataList);
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
