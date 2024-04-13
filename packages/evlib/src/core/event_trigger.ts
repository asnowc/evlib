import { ParameterTypeError, AbortedError } from "../errors.js";
import { withPromise } from "./promise.js";
import { BaseAbortSignal } from "./internal.js";

class EventTriggerImpl<T> implements Listenable<T>, EventTriggerController<T>, OnceListenable<T> {
  #queue = new Set<Listener<T>>();
  /** 单次触发 */
  #once = new Set<Listener<T>>();

  emit(arg: T): any;
  emit(arg: T) {
    const once = this.#once;
    this.#once = new Set();
    const size = this.#queue.size;
    for (const fn of this.#queue) {
      try {
        fn(arg);
      } catch (error) {}
    }
    for (const fn of once) {
      this.#queue.delete(fn);
    }
    return size;
  }
  then<R extends Listener<T>>(resolve: R): R {
    if (this.#done) throw createDoneError();
    else {
      if (this.#queue.has(resolve)) return resolve;
      this.on(resolve);
      this.#once.add(resolve);
    }
    return resolve;
  }
  on<R extends Listener<T>>(listener: R): R {
    if (this.#done) throw createDoneError();
    if (typeof listener !== "function") throw new ParameterTypeError(0, "function", typeof listener);
    this.#queue.add(listener);
    return listener;
  }
  off(listener: Function) {
    return this.#queue.delete(listener as any);
  }
  #done = false;
  get done() {
    return this.#done;
  }
  close() {
    this.#done = true;
    this.#queue.clear();
    this.#once.clear();
  }
}

interface EventTriggerConstructor {
  new <T>(): Listenable<T> & OnceListenable<T> & EventTriggerController<T>;
}
/** @public */
export const EventTrigger: EventTriggerConstructor = EventTriggerImpl;
/** @public */
export type EventTrigger<T> = Listenable<T> & EventTriggerController<T> & OnceListenable<T>;

/**
 * @public
 * @remarks 可订阅对象, 可通过 await 等待
 */
export interface Listenable<T> extends OnceListenable<T> {
  /** @remarks 订阅事件 */
  on<R extends Listener<T>>(listener: R): R;
  /**
   * @remarks 取消订阅事件
   * @returns 如果 subscriber 已经订阅， 则返回 true, 否则返回 false
   */
  off(listener: Fn): boolean;
  done: boolean;
}

interface EventTriggerController<T> {
  /**
   * @remarks 触发事件
   * @returns 返回监听器的数量
   */
  emit(data: T): number;
  close(): void;
}

interface Listener<T> {
  (arg: T): void;
}
function createDoneError() {
  return new Error("EventCenter is done");
}

type Fn = (...args: any[]) => any;

/** @public */
export interface OnceListenable<T> {
  /**
   * @remarks 与on()类似, 在触发前取消订阅, 可使用 await 语法等待
   * 如果 listener 之前已经订阅, 否则忽略
   * 如果事件已触发完成则抛出异常
   */
  then<R extends Listener<T>>(resolve: R): R;
}

interface SignalListener {
  signal: BaseAbortSignal;
  key: {};
  listeners: AsyncListenerList<unknown>;
  handleEvent(): void;
}
type AsyncListenerList<T, E = any> = Map<object, { resolve(data: T): void; reject(data: E): void }>;
/** @public */
export class OnceEventTrigger<T, E = any> implements OnceListenable<T> {
  #asyncListeners: AsyncListenerList<T, E> = new Map();
  #signals = new Set<SignalListener>();
  #done = false;
  get done() {
    return this.#done;
  }
  getPromise(signal?: BaseAbortSignal) {
    if (this.#done) return Promise.reject(createDoneError());
    const key = {};

    if (signal) {
      if (signal.aborted) return Promise.reject(signal.reason ?? new AbortedError());

      const signalListener: SignalListener = {
        signal,
        key,
        listeners: this.#asyncListeners,
        handleEvent() {
          this.signal.removeEventListener("abort", this);
          this.listeners.delete(key);
        },
      };
      signal.addEventListener("abort", signalListener);
      this.#signals.add(signalListener);
    }

    const item = withPromise<T>();
    this.#asyncListeners.set(key, item);
    return item.promise;
  }
  then<R extends Listener<T>>(resolve: R, reject?: (arg: E) => void): R {
    if (this.#done) throw createDoneError();
    this.#asyncListeners.set(resolve, { resolve, reject: reject ?? (() => {}) });
    return resolve;
  }
  emit(arg: T): number {
    this.#done = true;
    const size = this.#asyncListeners.size;
    this.clearSignal();
    for (const handle of this.#asyncListeners.values()) handle.resolve(arg);
    this.#asyncListeners.clear();
    return size;
  }
  emitError(err: E) {
    this.#done = true;
    const size = this.#asyncListeners.size;
    this.clearSignal();
    for (const handle of this.#asyncListeners.values()) handle.reject(err);
    this.#asyncListeners.clear();
    return size;
  }
  private clearSignal() {
    for (const signalInfo of this.#signals) signalInfo.signal.removeEventListener("abort", signalInfo);
    this.#signals.clear();
  }
}
