import type { Readable } from "stream";
import { createNoMoreDataErr } from "../errors.error.js";
/**
 * @alpha
 * @remarks
 * 等待流达到len的长度时,读取流,然后返回
 *
 * @throws
 */
export function readableRead(
  stream: Readable,
  len: number,
  abortSignal?: AbortSignal
): Promise<Buffer> {
  if (stream.readableLength >= len) return Promise.resolve(stream.read(len));
  return new Promise<Buffer>(function (resolve, reject) {
    abortSignal?.throwIfAborted();

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
      reject(createNoMoreDataErr());
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
    }

    abortSignal?.addEventListener("abort", onTimeout);
  });
}
