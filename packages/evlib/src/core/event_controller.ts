import { WithPromise, withPromise } from "./promise.js";
import { type Listenable } from "./listenable.js";
interface AsyncEvent<T> {
  (): Promise<T>;
}

interface Event<T> extends AsyncEvent<T>, Listenable<T> {
  done: boolean;
}
/** @public */
export interface EventController<T> extends Event<T> {
  emit(data: T): number;
  close(): void;
}

/**
 * @__NO_SIDE_EFFECTS__
 * @public */
export function createEvent<T>(): EventController<T> {
  type Listener = (data: T) => void;
  const listeners = new Set<Listener>();
  const once = new Set<Listener>();
  const asyncListeners = new Set<WithPromise<T>>();

  function onPromise(): Promise<T> {
    if (Event.done) return Promise.reject(createDoneError());
    const item = withPromise<T>();
    asyncListeners.add(item);
    return item.promise;
  }
  function on<L extends Listener>(fn: L): L {
    if (Event.done) return fn;
    if (typeof fn === "function") listeners.add(fn);
    return fn;
  }
  const off: Listenable<T>["off"] = function off(fn: Fn) {
    let isDelete = listeners.delete(fn);
    if (isDelete) once.delete(fn);
    return isDelete;
  };
  const then: Listenable<T>["then"] = function then(fn) {
    if (Event.done) return fn;
    if (!listeners.has(fn)) {
      on(fn);
      once.add(fn);
    }
    return fn;
  };
  const emit: EventController<T>["emit"] = function emit(data: T): number {
    const count = listeners.size + asyncListeners.size;
    for (const fn of listeners) {
      try {
        fn(data);
      } catch (error) {}
      if (once.has(fn)) once.delete(fn);
    }
    for (const fn of asyncListeners) fn.resolve(data);
    asyncListeners.clear();
    return count;
  };
  const close: EventController<T>["close"] = function close() {
    Event.done = true;
    listeners.clear();
    once.clear();
    for (const item of asyncListeners) {
      item.reject(createDoneError());
    }
    asyncListeners.clear();
  };
  function Event(): Promise<T>;
  function Event<L extends (arg: T) => void>(listener: L): L;
  function Event(): Promise<T> | ((arg: any) => void) {
    return onPromise();
  }
  Event.done = false;
  Event.off = off;
  Event.then = then;
  Event.emit = emit;
  Event.close = close;
  Event.on = on;

  return Event;
}
function createDoneError() {
  return new Error("Event is done");
}
type Fn = (...args: any[]) => any;
