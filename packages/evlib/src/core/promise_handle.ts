import { createTimeoutHandle } from "./dispatch.js";

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
/** @alpha */
export function afterTimeHandle(time?: number, timeoutReject?: Error) {
    let resolve!: () => void, reject!: (reason?: any) => void;
    let cancel!: () => void;
    const promise = new Promise<void>(function (resolveFn, rejectFn) {
        resolve = resolveFn;
        reject = rejectFn;
        cancel = createTimeoutHandle(timeoutReject ? () => reject(timeoutReject) : resolve, time);
    });

    return {
        promise,
        resolve() {
            cancel();
            resolve();
        },
        reject(reason?: any) {
            cancel();
            reject(reason);
        },
    };
}
