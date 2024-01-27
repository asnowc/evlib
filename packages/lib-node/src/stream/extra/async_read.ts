import type { Readable } from "stream";

/**
 * @alpha
 * @remarks
 * 等待流达到len的长度时,读取流,然后返回
 *
 * @throws
 */
export function readableRead(stream: Readable, len: number, abortSignal?: AbortSignal): Promise<Buffer> {
  if (Object.hasOwn(stream, asyncRead)) return Promise.reject(new Error("前一个异步读取解决之前不能再继续调用"));
  else if (stream.readableLength >= len) return Promise.resolve(stream.read(len));
  return new Promise<Buffer>(function (resolve, reject) {
    abortSignal?.throwIfAborted();
    Object.defineProperty(stream, asyncRead, { value: true, writable: true, configurable: true });

    const view = Buffer.allocUnsafe(len);
    let offset = 0;

    function onReadable() {
      let need = view.byteLength - offset;
      if (stream.readableLength >= need) {
        view.set(stream.read(need)!, offset);
        clear();
        resolve(view);
      } else {
        const chunk: Buffer = stream.read();
        if (chunk) {
          view.set(chunk, offset);
          offset += chunk.byteLength;
        }
      }
    }
    function onEnd() {
      clear();
      reject(new Error("no more data"));
    }
    stream.pause();
    stream.on("readable", onReadable);
    stream.on("end", onEnd);
    stream.on("close", onEnd);

    function onTimeout() {
      clear();
      reject(abortSignal!.reason);
    }
    function clear() {
      stream.off("readable", onReadable);
      stream.off("end", onEnd);
      stream.off("close", onEnd);
      abortSignal?.removeEventListener("abort", onTimeout);
      Reflect.deleteProperty(stream, asyncRead);
    }

    abortSignal?.addEventListener("abort", onTimeout);
  });
}
const asyncRead = Symbol("asyncRead");
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
