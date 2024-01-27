/**
 * @deprecated 改用 createEvent
 * @public
 * @remarks 与 Node 的 EventEmitter 类似仅实现最基本功能
 * @event error 如果触发Listener时出现异常,会在触发事件结束后触发error事件, 参数为 EventError
 */
export class EventEmitter<T extends EventList = {}> {
  #listeners = new Map<EventName, Set<EvListener>>();
  on<E extends keyof T, Fn extends T[E]>(name: E, fn: Fn): Fn;
  on<E extends EventName, Fn extends LimitEvListener<T, E>>(name: E, fn: Fn): Fn;
  on(name: EventName, fn: EvListener) {
    let list = this.#listeners.get(name);
    if (!list) {
      list = new Set();
      this.#listeners.set(name, list);
    }
    list.add(fn);
    return fn;
  }
  off<E extends keyof T>(name: E, fn: Function): void;
  off(name: EventName, fn: Function): void;
  off(name: EventName, fn: EvListener) {
    this.#listeners.get(name)?.delete(fn);
    return this;
  }
  emit<E extends keyof T, Prams extends T[E]>(name: E, ...args: Prams): number;
  emit<E extends EventName, Prams extends LimitEmitPrams<T, E>>(name: E, ...args: Prams): number;
  emit(name: EventName, ...args: any[]) {
    if (name === "error") return this.#emitError(args);

    const listeners = this.#listeners.get(name);
    const size = listeners?.size;
    if (!size) return 0;

    const errors: any[] = [];
    for (const fn of listeners) {
      try {
        fn.apply(this, args);
      } catch (error) {
        errors.push(error);
      }
    }
    this.#emitError([new EventError(errors, name)]);
    return size;
  }
  #emitError(args: any[]) {
    const listeners = this.#listeners.get("error");
    if (!listeners?.size) return false;

    for (const fn of listeners) {
      try {
        fn.call(this, ...args);
      } catch (error) {}
    }
  }
}
type EvListener = (...args: any[]) => void;
type EventName = string | symbol;

/** @public */
export type EventList = {
  [key: EventName]: any[];
};

type LimitEmitPrams<T extends EventList, K> = K extends keyof T ? T[K] : any[];
type LimitEvListener<T extends EventList, K extends EventName> = T[K] extends any[]
  ? (...args: T[K]) => void
  : EvListener;

class EventError extends Error {
  constructor(cause: any, readonly eventName: EventName) {
    super("Listener exception", { cause });
  }
}
