/**
 * @public
 * @remarks 空函数类型
 */
export interface VoidFn {
  (): void;
}
/**
 * @public
 * @remarks 可中断的 Promise
 */
export interface TerminablePromise<T> extends Promise<T> {
  abort(reason?: Error): void;
}
/** @public */
export interface PromiseHandle<T> {
  resolve(data: T): void;
  reject(reason?: any): void;
}
/**
 * @public
 * @remarks 可控制的 Promise
 */
export interface ControllablePromise<T> extends Promise<T> {
  resolve(data: T): void;
  reject(reason?: any): void;
}
/** @public */
export type ObjectKey = string | number | symbol;
