import { ParameterTypeError } from "../errors.js";
import { WithPromise, withPromise } from "./promise.js";

/** @public */
export const Listenable: ListenableConstructor = class Listenable<T, E> {
  #queue = new Set<Listener<T, E>>();
  /** 单次触发 */
  #once = new Set<Listener<T, E>>();
  get count() {
    return this.#queue.size;
  }
  done = false;
  emit(arg: T | E, error?: boolean): any;
  emit(arg: T | E, error = false) {
    const once = this.#once;
    this.#once = new Set();
    const size = this.#queue.size;
    for (const fn of this.#queue) {
      try {
        fn(arg, error);
      } catch (error) {}
    }
    for (const fn of once) {
      this.#queue.delete(fn);
    }
    return size;
  }
  emitError(arg: E): number {
    return this.emit(arg, true);
  }

  then(listener: any): any;
  then<R extends Listener<T, E>>(listener: R): R {
    if (this.done) throw createDoneError();
    if (this.#queue.has(listener)) return listener;
    this.on(listener);
    this.#once.add(listener);
    return listener;
  }
  on(listener: any): any;
  on<R extends Listener<T, E>>(listener: R): R {
    if (this.done) throw createDoneError();
    if (typeof listener !== "function") throw new ParameterTypeError(0, "function", typeof listener);
    this.#queue.add(listener);
    return listener;
  }
  close() {
    this.done = true;
    this.#queue.clear();
    this.#once.clear();
  }

  off(listener: Function) {
    return this.#queue.delete(listener as any);
  }
  listening(listener: Function) {
    return this.#queue.has(listener as any);
  }
};

interface ListenableConstructor {
  new <T, E = T>(): Listenable<T, E> &
    EventController<T, E> & {
      /**
       * @deprecated
       * @remarks 订阅者的数量 */
      count: number;
      /**
       * @deprecated
       * @remarks 订阅者是否已经在订阅中 */
      listening(listener: Fn): boolean;
    };
}

/**
 * @public
 * @remarks 可订阅对象, 可通过 await 等待
 */
export interface Listenable<T, E = T> {
  /**
   * @remarks 与on()类似, 在触发前取消订阅, 可使用 await 语法等待
   * 如果 listener 之前已经订阅, 则忽略
   */
  then<R extends Listener<T, E>>(listener: R): R;
  /** @remarks 订阅事件 */
  on<R extends Listener<T, E>>(listener: R): R;
  /**
   * @remarks 取消订阅事件
   * @returns 如果 subscriber 已经订阅， 则返回 true, 否则返回 false
   */
  off(listener: Fn): boolean;
  done: boolean;
}
interface Listener<T, E = T> {
  (arg: T, error: false): void;
  (arg: E, error: true): void;
  (arg: E | T, error: boolean): void;
}
function createDoneError() {
  return new Error("EventCenter is done");
}
/** @public */
export interface EventController<T, E = T> {
  /**
   * @remarks 触发事件
   * @returns 返回监听器的数量
   */
  emit(data: T): number;
  /**
   * @deprecated 已弃用
   * @remarks 触发事件
   * @returns 返回监听器的数量
   */
  emit(data: E | T, reject: boolean): number;
  emitError(data: E): number;
  close(): void;
}
interface AsyncEvent<T> {
  (): Promise<T>;
}
/** @public */
export type EventCenter<T, E = T> = EventController<T, E> & AsyncEvent<T> & Listenable<T, E>;
/**
 * @__NO_SIDE_EFFECTS__
 * @public */
export function createEvent<T, E = T>(): EventCenter<T, E> {
  const listenable = new Listenable();
  const asyncListeners = new Set<WithPromise<T>>();

  const asyncEvent = function AsyncEvent(): Promise<T> {
    if (listenable.done) return Promise.reject(createDoneError());
    const item = withPromise<T>();
    asyncListeners.add(item);
    return item.promise;
  } as EventCenter<T, E>;

  function emitAsync(data: T, reject: boolean) {
    let size = asyncListeners.size;
    if (reject) for (const fn of asyncListeners) fn.reject(data);
    else for (const fn of asyncListeners) fn.resolve(data);
    asyncListeners.clear();
    return size;
  }

  const close: EventController<T, E>["close"] = function close() {
    listenable.close();
    for (const item of asyncListeners) item.reject(createDoneError());
    asyncListeners.clear();
  };
  const emit: EventController<T, E>["emit"] = function emit(data, reject: boolean = false): number {
    return listenable.emit(data, reject) + emitAsync(data as any, reject);
  };

  Object.defineProperty(asyncEvent, "done", {
    get() {
      return listenable.done;
    },
  });
  asyncEvent.off = listenable.off.bind(listenable);
  asyncEvent.on = listenable.on.bind(listenable);
  asyncEvent.then = listenable.then.bind(listenable);
  asyncEvent.emitError = listenable.emitError.bind(listenable);
  asyncEvent.emit = emit;
  asyncEvent.close = close;

  return asyncEvent;
}

type Fn = (...args: any[]) => any;
