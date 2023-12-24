import type { PromiseHandle } from "./type.js";

/** @alpha */
export type PPPromiseHandle<T> = PromiseHandle<T> & {
  promise: Promise<T>;
};
/**
 * @public
 * @remarks 返回一个 promise 和控制这个 promise 的句柄
 */
export function promiseHandle<T>(): PPPromiseHandle<T> {
  let resolve!: (arg: T) => void, reject!: () => void;
  const promise = new Promise<T>(function (resolveFn, rejectFn) {
    resolve = resolveFn;
    reject = rejectFn;
  });

  return { promise, resolve, reject };
}
/**
 * @public
 * @remarks 尽量以同步的方式处理一个可能是 Promise 的值
 */
export function dePromise<T, R>(val: T | Promise<T>, fn: (val: T) => R) {
  if (val instanceof Promise) return val.then(fn);
  return fn(val);
}
