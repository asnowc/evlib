/** @public */
export interface PromiseHandle<T> {
    resolve(arg: T): void;
    reject(reason?: any): void;
}
/** @alpha */
export interface PPPromiseHandle<T> extends PromiseHandle<T> {
    promise: Promise<T>;
}
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
