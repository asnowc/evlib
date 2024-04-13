/**
 * @public
 * @remarks 返回一个 promise 和控制这个 promise 的句柄
 */
export function withPromise<T, R = any, E extends object = {}>(
  handle?: E,
): WithPromise<T, R> & E;
export function withPromise(
  handle: Record<string, any> = {},
): WithPromise<unknown, unknown> {
  handle.promise = new Promise(function (resolve, reject) {
    handle.resolve = resolve;
    handle.reject = reject;
  });
  return handle as any;
}

/**
 * @public
 * @remarks 尽量以同步的方式处理一个可能是 Promise 的值
 */
export function dePromise<T, R>(val: T | Promise<T>, fn: (val: T) => R) {
  if (val instanceof Promise) return val.then(fn);
  return fn(val);
}
/** @public */
export interface WithPromise<T, R = any> {
  resolve(data: T): void;
  reject(data: R): void;
  promise: Promise<T>;
}
