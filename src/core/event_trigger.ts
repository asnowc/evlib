import { AbortedError, ParameterTypeError } from "./errors.ts";
import { PruneAbortSignal } from "./internal.ts";

class EventTriggerImpl<T> implements Listenable<T>, EventTriggerController<T> {
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
  once<R extends Listener<T>>(resolve: R): R {
    if (this.#done) throw createDoneError();
    else {
      if (this.#queue.has(resolve)) return resolve;
      this.on(resolve);
      this.#once.add(resolve);
    }
    return resolve;
  }
  then(resolve: Listener<T>): void {
    this.once(resolve);
  }
  on<R extends Listener<T>>(listener: R): R {
    if (this.#done) throw createDoneError();
    if (typeof listener !== "function") {
      throw new ParameterTypeError(0, "function", typeof listener);
    }
    this.#queue.add(listener);
    return listener;
  }
  off(listener: object) {
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

/** @public */
export const EventTrigger: new <T>() => EventTrigger<T> = EventTriggerImpl;
/** @public */
export type EventTrigger<T> = Listenable<T> & EventTriggerController<T>;

/** 可订阅对象, 可通过 await 等待
 * @public
 */
export interface Listenable<T> {
  /** then 的别名，它会返回 resolve 函数 */
  once<R extends Listener<T>>(resolve: R): R;
  /** 与on()类似, 在触发前取消订阅, 可使用 await 语法等待
   * @remarks
   * 如果 listener 之前已经订阅, 否则忽略
   * 如果事件已触发完成则抛出异常
   */
  then(resolve: Listener<T>): void;
  /** 订阅事件 */
  on<R extends Listener<T>>(listener: R): R;
  /** 取消订阅事件
   * @returns 如果已经订阅， 则返回 true, 否则返回 false
   */
  off(key: object): boolean;
  done: boolean;
}

interface EventTriggerController<T> {
  /** 触发事件
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

/** 一次性可订阅对象, 可通过 await 等待
 * @public
 */
export interface OnceListenable<T> {
  /** then 的别名，它会返回 resolve 函数 */
  once<R extends Listener<T>>(resolve: R): R;
  /** 订阅事件。
   * @remarks
   * 如果 listener 之前已经订阅, 否则抛出异常
   * 如果事件已触发完成则抛出异常
   */
  then(resolve: Listener<T>, reject?: (data?: any) => void): void;
  /** 这个是订阅 emitError() 触发的事件 */
  catch<R extends (reason: any) => void>(listener: R): void;
  /** 无论最终是 emit 还是 emitError. 都会被触发 */
  finally(listener: () => void): void;
  /** 取消订阅事件
   * @returns 如果已经订阅， 则返回 true, 否则返回 false
   */
  off(key: object): boolean;
  /** 事件是否已经被触发 */
  done: boolean;
}

interface SignalListener {
  reject: (reason: any) => void;
  signal: PruneAbortSignal;
  listeners: AsyncListenerList<unknown>;
  handleEvent(): void;
}
type AsyncListenerInfo<T> = {
  resolve?(data: T): void;
  reject?(data?: any): void;
  signalListener?: SignalListener;
};
type AsyncListenerList<T> = Map<object, AsyncListenerInfo<T>>;
/** 一次性可订阅对象, 可通过 await 语法等待触发
 * @public */
export class OnceEventTrigger<T> implements OnceListenable<T> {
  #asyncListeners: AsyncListenerList<T> = new Map();
  #done = false;
  get done(): boolean {
    return this.#done;
  }
  /** promise 模式的订阅
   */
  getPromise(signal?: PruneAbortSignal): Promise<T> {
    if (this.#done) return Promise.reject(createDoneError());
    let item!: AsyncListenerInfo<T>;
    const prom = new Promise<T>(function (resolve, reject) {
      item = { resolve, reject } as any;
    });
    const key = item.reject!;
    if (signal) {
      if (signal.aborted) {
        return Promise.reject(signal.reason ?? new AbortedError());
      }

      const signalListener: SignalListener = {
        reject: key,
        signal,
        listeners: this.#asyncListeners,
        handleEvent() {
          this.listeners.delete(this.reject);
          this.reject(this.signal.reason);
        },
      };
      signal.addEventListener("abort", signalListener, { once: true });
      item.signalListener = signalListener;
    }
    this.#asyncListeners.set(key, item!);
    return prom;
  }
  off(key: object): boolean {
    const item = this.#asyncListeners.get(key);
    if (!item) return false;
    this.#asyncListeners.delete(key);
    item.signalListener?.signal.removeEventListener(
      "abort",
      item.signalListener,
    );
    return true;
  }
  #setListener(key: object, listener: AsyncListenerInfo<T>) {
    if (this.#asyncListeners.has(key)) throw new Error("Repeated listener");
    this.#asyncListeners.set(key, listener);
  }
  /** 与 then 类似，它会返回 resolve 函数 */
  once<R extends Listener<T>>(resolve: R, reject?: (arg: any) => void): R {
    if (this.#done) throw createDoneError();
    if (typeof resolve !== "function") {
      throw new TypeError("listener must be a function");
    }
    this.#setListener(resolve, { resolve, reject });
    return resolve;
  }
  then(resolve: Listener<T>, reject?: (arg: any) => void): void {
    this.once(resolve, reject);
  }
  catch(listener: (err: any) => void): void {
    if (this.#done) throw createDoneError();
    if (typeof listener !== "function") {
      throw new TypeError("listener must be a function");
    }
    this.#setListener(listener, { reject: listener });
    return;
  }
  finally(listener: () => void): void {
    this.then(listener, listener);
  }
  /** 触发事件 */
  emit(arg: T): number {
    this.#done = true;
    let size = 0;
    for (const handle of this.#asyncListeners.values()) {
      if (handle.resolve) {
        size++;
        handle.resolve(arg);
      }
      handle.signalListener?.signal.removeEventListener(
        "abort",
        handle.signalListener,
      );
    }
    this.#asyncListeners.clear();
    return size;
  }
  /** 以异常触发事件 */
  emitError(err: any): number {
    this.#done = true;
    let size = 0;
    for (const handle of this.#asyncListeners.values()) {
      if (handle.reject) {
        size++;
        handle.reject(err);
      }
      handle.signalListener?.signal.removeEventListener(
        "abort",
        handle.signalListener,
      );
    }
    this.#asyncListeners.clear();
    return size;
  }
}
