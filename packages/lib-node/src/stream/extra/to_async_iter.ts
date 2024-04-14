import { Readable } from "node:stream";
import { createAbortedError } from "../errors.error.js";
/**
 * @public
 * @remarks 将 Readable 转为 异步迭代器。它与 Readable[Symbol.asyncIterable] 行为不同。
 * 它会迭代 push 的 chunk.
 * 如果调用 .return()，不会调用 Readable.destroy().
 * 如果调用 .throw() 则会调用 Readable.destroy()
 */
export async function* readableToAsyncIterator<T extends Uint8Array>(
  readable: Readable
): AsyncGenerator<T, void, void> {
  if (!readable.readable) {
    if (readable.errored) throw readable.errored;
    return;
  }
  if (readable.listenerCount("readable"))
    readable.removeAllListeners("readable");
  readable.pause();
  let handle:
    | {
        resolve(data: T): void;
        reject(reason: any): void;
      }
    | undefined;
  function onData(chunk: T) {
    if (handle) {
      handle.resolve(chunk);
      handle = undefined;
    }
    readable.pause();
  }
  function onAbort(err: any) {
    if (!(err instanceof Error)) err = createAbortedError();
    if (handle) {
      handle.reject(err);
      handle = undefined;
    }
  }

  readable.on("data", onData);
  readable.on("end", onAbort); //必须。如果是 Duplex，close 事件不会立即触发
  readable.on("close", onAbort); //必须。如果 readable.destroy() 被调用时不传入参数，仅触发 close 事件(end 和 error事件均不会被触发)
  readable.on("error", onAbort);

  try {
    while (readable.readable) {
      yield await new Promise<T>(function (resolve, reject) {
        handle = {
          resolve,
          reject,
        };
        readable.resume();
      });
    }
  } catch (error) {
    if (readable.readableEnded) return;
    if (readable.readable) {
      const err: Error = error instanceof Error ? error : createAbortedError();
      readable.destroy(err);
      const awaitable: any = {
        then(resolve: () => void) {
          readable.once("error", resolve);
        },
      };
      await awaitable;
    } else throw error;
  } finally {
    readable.off("data", onData);
    readable.off("end", onAbort);
    readable.off("close", onAbort);
    readable.off("error", onAbort);
    readable.pause();
  }
}
