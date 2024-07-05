import * as timer from "./internal.ts";
import type { VoidFn, TerminablePromise } from "./type.ts";

/** 设置一个计时器, 在指定的时间后执行 fn
 * @public
 * @param timeout - 定时时间，单位毫秒。
 * @returns 返回一个函数，可用在定时器触发前取消定时器
 */
export function setTimer(fn: VoidFn, timeout: number = 0): () => void {
  let id: number | undefined = timer.setTimeout(function () {
    id = undefined;
    fn();
  }, timeout);
  return function clear() {
    timer.clearTimeout(id);
    id = undefined;
  };
}

/** 设置定时器
 * @public
 * @param intervalTime - 间隔时间，单位毫秒
 * @returns 返回一个函数，可用关闭定时器
 */
export function setInterval(fn: VoidFn, intervalTime: number = 0): () => void {
  let id: number | undefined = timer.setInterval(function () {
    id = undefined;
    fn();
  }, intervalTime);
  return function close() {
    timer.clearInterval(id);
    id = undefined;
  };
}

/** 返回一个 TerminablePromise, 在指定时间后 resolve, 执行abort() 将执行取消定时, 并拒绝 Promise
 * @public
 */
export function afterTime(time?: number): TerminablePromise<void> {
  let abort!: (reason?: Error) => void;
  let p: TerminablePromise<void> = new Promise<void>((resolve, reject) => {
    let id: number | undefined = timer.setTimeout(function () {
      id = undefined;
      resolve();
    }, time);
    timer.setTimeout(resolve, time);
    abort = function abort(reason?: Error) {
      timer.clearTimeout(id);
      id = undefined;
      reject(reason);
    };
  }) as any;
  p.abort = abort;
  return p;
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