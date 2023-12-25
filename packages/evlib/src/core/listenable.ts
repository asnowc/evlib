import { ParameterTypeError } from "../errors.js";

/** @public */
export const Listenable: ListenableConstructor = class Listenable<T> {
  #queue = new Set<Listener<T>>();
  /** 单次触发 */
  #once = new Set<Listener<T>>();

  get count() {
    return this.#queue.size;
  }

  emit(arg: T) {
    const size = this.#queue.size;
    for (const listener of this.#queue) {
      if (this.#once.has(listener)) {
        this.#once.delete(listener);
        this.#queue.delete(listener);
      }
      try {
        listener(arg);
      } catch (error) {}
    }
    return size;
  }

  then<R extends Listener<T>>(listener: R): R {
    if (this.#queue.has(listener)) return listener;
    this.on(listener);
    this.#once.add(listener);
    return listener;
  }
  on<R extends Listener<T>>(listener: R): R {
    if (typeof listener !== "function") throw new ParameterTypeError(0, "function", typeof listener);
    this.#queue.add(listener);
    return listener;
  }

  off(listener: Function) {
    return this.#queue.delete(listener as any);
  }
  listening(listener: Function) {
    return this.#queue.has(listener as any);
  }
};

interface ListenableConstructor {
  new <T>(): Listenable<T>;
}
/**
 * @public
 * @remarks 可订阅对象, 可通过 await 等待
 */
export interface Listenable<T> {
  /** @remarks 订阅者的数量 */
  count: number;
  /**
   * @remarks 触发事件
   * @returns 返回监听器的数量
   */
  emit(arg: T): number;
  /**
   * @remarks 与on()类似, 在触发前取消订阅, 可使用 await 语法等待
   * 如果 listener 之前已经订阅, 则忽略
   * @example
   */
  then<R extends Listener<T>>(listener: R): R;
  /** @remarks 订阅事件 */
  on<R extends Listener<T>>(listener: R): R;
  /**
   * @remarks 取消订阅事件
   * @returns 如果 subscriber 已经订阅， 则返回 true, 否则返回 false
   */
  off(listener: Function): boolean;
  /** @remarks 订阅者是否已经在订阅中 */
  listening(listener: Function): boolean;
}
type Listener<T> = (arg: T) => void;
