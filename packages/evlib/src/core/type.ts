/** 空函数类型
 * @public
 */
export interface VoidFn {
  (): void;
}
/** 可中断的 Promise
 * @public
 */
export interface TerminablePromise<T> extends Promise<T> {
  abort(reason?: Error): void;
}
/** @public */
export interface PromiseHandle<T> {
  resolve(data: T): void;
  reject(reason?: any): void;
}

/** 可控制的 Promise
 * @public
 */
export interface ControllablePromise<T> extends Promise<T> {
  resolve(data: T): void;
  reject(reason?: any): void;
}
/** @public */
export type ObjectKey = string | number | symbol;
