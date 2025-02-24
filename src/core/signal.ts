import { PruneAbortSignal } from "./internal.ts";

class ListenSignal {
  constructor(
    private _listener: (this: PruneAbortSignal) => void,
    private signal: PruneAbortSignal | undefined,
  ) {
    if (signal) {
      signal.throwIfAborted();
      signal.addEventListener("abort", _listener);
    }
  }
  dispose() {
    this.signal?.removeEventListener("abort", this._listener);
  }
  //@ts-expect-error 当 lib 改为 es2022 后可以移除注释
  [Symbol.dispose] = this.dispose;
}
/**
 * 订阅 AbortSignal 的 abort 事件
 * ```ts
 * const abc = new AbortController();
 * using signal = listenSignal(abc.signal, () => {}); // 在离开作用域时自动取消监听
 * ```
 * @public
 */
export function listenSignal(
  signal: PruneAbortSignal | undefined,
  listener: (this: PruneAbortSignal) => void,
): {
  //@ts-expect-error 当 lib 改为 es2022 后可以移除注释
  [Symbol.dispose](): void;
  dispose(): void;
} {
  return new ListenSignal(listener, signal);
}
