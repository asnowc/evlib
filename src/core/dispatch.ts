import * as timer from "./internal.ts";
import type { TerminablePromise, VoidFn } from "./type.ts";

/** 设置一个计时器, 在指定的时间后执行 fn
 * @public
 * @param timeout - 定时时间，单位毫秒。
 * @returns 返回一个函数，可用在定时器触发前取消定时器
 */
export function setTimer(fn: VoidFn, timeout: number = 0): () => void {
  const setTimeout = timer.setTimeout;
  let id: number | undefined = setTimeout(function () {
    id = undefined;
    fn();
  }, timeout);
  return function clear() {
    const clearInterval = timer.clearTimeout;
    clearInterval(id);
    id = undefined;
  };
}

/** 设置定时器
 * @public
 * @param intervalTime - 间隔时间，单位毫秒
 * @returns 返回一个函数，可用关闭定时器
 */
export function setInterval(fn: VoidFn, intervalTime: number = 0): () => void {
  const setInterval = timer.setInterval;
  let id: number | undefined = setInterval(function () {
    id = undefined;
    fn();
  }, intervalTime);
  return function close() {
    const clearInterval = timer.clearInterval;
    clearInterval(id);
    id = undefined;
  };
}

/** 返回一个 TerminablePromise, 在指定时间后 resolve, 执行abort() 将执行取消定时, 并拒绝 Promise
 * @public
 */
export function afterTime(time?: number): TerminablePromise<void> {
  let abort!: (reason?: Error) => void;
  const setTimeout = timer.setTimeout;
  const clearTimeout = timer.clearTimeout;

  let p: TerminablePromise<void> = new Promise<void>((resolve, reject) => {
    let id: number | undefined = timer.setTimeout(function () {
      id = undefined;
      resolve();
    }, time);
    setTimeout(resolve, time);
    abort = function abort(reason?: Error) {
      clearTimeout(id);
      id = undefined;
      reject(reason);
    };
  }) as any;
  p.abort = abort;
  return p;
}
/**
 * 调用时记录时间，返回一个函数，这个函数根据记录的时间设置计时器，相当于 wakeUpIn() 调用的时候开始计时
 * @public
 * @example
 * ```ts
 * const sleep=wakeUpIn(1000)
 * // do some thing....
 * await sleep()
 *
 * ```
 */
export function wakeUpIn(min: number): () => Promise<void> {
  let tTime = Date.now();
  return function () {
    tTime = min - (Date.now() - tTime);
    return new Promise<void>((resolve) => {
      setTimeout(resolve, tTime);
    });
  };
}
/** 超时控制器，超时将自动执行 abort()
 * @alpha
 */
//class TimeoutController extends AbortController {
//    private id?: number;
//    constructor(timeout: number) {
//        super();
//        this.clear = createTimeoutHandle(() => {
//            this.abort();
//        }, timeout);
//    }
//    /**
//     * @description 如果在超时前执行abort，则将自动取消超时执行
//     */
//    abort(): void {
//        this.clear();
//        (super.abort as any)(new TimeoutError());
//    }
//    /** 取消超时执行 */
//    clear: VoidFunction;
//}
