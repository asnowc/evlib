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
  //@ts-ignore 需要 esnext
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
  //@ts-ignore 需要 esnext
  [Symbol.dispose](): void;
  dispose(): void;
} {
  return new ListenSignal(listener, signal);
}
