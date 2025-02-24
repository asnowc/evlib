import { EventTrigger, OnceEventTrigger } from "evlib";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("EventTrigger", function () {
  let listenable: EventTrigger<any>;
  const listener = vi.fn();
  beforeEach(() => {
    listenable = new EventTrigger();
    listener.mockReset();
  });
  test("订阅1个", function () {
    expect(listenable.on(listener), "返回原函数").toBe(listener);
    expect(listenable.emit(1), "订阅者数量").toBe(1);
    expect(listener, "监听器触发1次").toBeCalledTimes(1);
    expect(listener, "监听器参数是1").toBeCalledWith(1);
  });
  test("订阅多个", function () {
    let emit = 0;
    const implFn = () => emit++; //返回被执行时的顺序
    const listeners = [1, 2, 3, 4].map(() => {
      const listener = vi.fn(implFn);
      listenable.on(listener);
      return listener;
    });

    const data = Symbol();

    expect(listenable.emit(data), "订阅者数量").toBe(listeners.length);

    for (let i = 0; i < listeners.length; i++) {
      expect(listeners[i].mock.calls[0], "相同的调用参数-" + i).toEqual([data]);
      expect(listeners[i].mock.results[0].value, "按顺序调用-" + i).toBe(i);
    }
  });
  describe("then", function () {
    test("await", async function () {
      setTimeout(() => listenable.emit(1));
      const data = await listenable;
      expect(data).toBe(1);
    });
    test("await try catch", async function () {
      listenable.close();
      try {
        await listenable;
        expect.fail("没有抛出异常");
      } catch (error) {
        expect(error).instanceof(Error);
      }
    });
  });
  test("按顺序触发", function () {
    let i = 0;
    const once = vi.fn(() => i++);
    const first = vi.fn(() => i++);
    const last = vi.fn(() => i++);
    listenable.on(first);
    listenable.then(once);
    listenable.on(last);
    expect(listenable.emit(null), "触发数量为3").toBe(3);

    expect(first.mock.results[0].value).toBe(0);
    expect(once.mock.results[0].value).toBe(1);
    expect(last.mock.results[0].value).toBe(2);

    expect(listenable.emit(null), "触发数量为2").toBe(2);
    expect(once, "仅触发1次").toBeCalledTimes(1);
    expect(last, "触发2次").toBeCalledTimes(2);
  });

  test("触发中途取消订阅", function () {
    const a = () => listenable.off(d);
    const c = () => {};
    const d = vi.fn();
    listenable.on(a);
    listenable.on(c);
    listenable.on(d);
    expect(d).not.toBeCalled();
  });
  test("then 之前已有订阅", function () {
    const listener = vi.fn();
    listenable.on(listener);
    listenable.then(listener);
    listenable.emit(null);
    listenable.emit(null);
    listenable.emit(null);
    expect(listener).toBeCalledTimes(3);
  });
  test("重复订阅", function () {
    listenable.on(listener);
    listenable.on(listener);
    listenable.then(listener);
    listenable.emit(1);
    expect(listener).toBeCalledTimes(1);
    listenable.emit(1);
    expect(listener).toBeCalledTimes(2);
  });

  test("close", function () {
    listenable.close();
    expect(() => listenable.on(() => {})).toThrowError();
    expect(() => listenable.then(() => {})).toThrowError();
  });
});

describe("OnceEventTrigger", function () {
  let event!: OnceEventTrigger<any>;
  beforeEach(() => {
    event = new OnceEventTrigger();
  });
  test("同步订阅成功", function () {
    const onOk = vi.fn();
    const onFinally = vi.fn();
    event.then(onOk);
    event.finally(onFinally);
    event.emit(1);
    expect(onOk).toBeCalledTimes(1);
    expect(onFinally).toBeCalledTimes(1);
  });
  test("同步订阅失败", function () {
    const onCatch = vi.fn();
    const onFinally = vi.fn();
    event.catch(onCatch);
    event.finally(onFinally);
    event.emitError(1);
    expect(onCatch).toBeCalledTimes(1);
    expect(onFinally).toBeCalledTimes(1);
  });

  test("订阅1个promise", async function () {
    const res = event.getPromise();
    expect(res, "返回原函数").instanceof(Promise);
    expect(event.emit(1), "订阅者数量").toBe(1);
    await expect(res).resolves.toBe(1);
  });
  test("订阅多个promise", async function () {
    const listeners = [1, 2, 3, 4].map(() => event.getPromise());
    const data = Symbol();
    expect(event.emit(data), "订阅者数量").toBe(listeners.length);
    await expect(Promise.all(listeners)).resolves.toEqual([
      data,
      data,
      data,
      data,
    ]);
  });
  test("同步与异步同时监听", async function () {
    let i = 0;
    const fn3 = vi.fn(() => i++);
    const fn4 = vi.fn(() => i++);
    const fn1 = vi.fn(() => i++);
    const fn2 = vi.fn(() => i++);
    event.then(fn1);
    const p1 = event.getPromise().then(fn3);
    event.then(fn2);
    const p2 = event.getPromise().then(fn4);
    expect(event.emit(12)).toBe(4);
    await p2;
    expect(fn1.mock.results[0].value).toBe(0);
    expect(fn2.mock.results[0].value).toBe(1);
    expect(fn3.mock.results[0].value).toBe(2);
    expect(fn4.mock.results[0].value).toBe(3);
  });
  test("emit error", async function () {
    let pms = event.getPromise();
    event.emitError(8);
    await expect(pms).rejects.toBe(8);
  });
  test("close", async function () {
    event.emit(1);
    await expect(event.getPromise()).rejects.toThrowError();
  });
  test("signal", async function () {
    const abc = new AbortController();
    const pms = event.getPromise(abc.signal);
    const data = Symbol("aa");
    abc.abort(data);
    await expect(pms).rejects.toBe(data);
    expect(event.done).toBeFalsy();
  });
  describe("重复订阅", function () {
    test("then 之后重复订阅", function () {
      const key = vi.fn();
      event.then(key);
      expect(() => event.then(key)).toThrowError();
      expect(() => event.catch(key)).toThrowError();
      expect(() => event.finally(key)).toThrowError();
    });
    test("catch 之后重复订阅", function () {
      const key = vi.fn();
      event.catch(key);
      expect(() => event.then(key)).toThrowError();
      expect(() => event.catch(key)).toThrowError();
      expect(() => event.finally(key)).toThrowError();
    });
    test("finally 之后重复订阅", function () {
      const key = vi.fn();
      event.finally(key);
      expect(() => event.then(key)).toThrowError();
      expect(() => event.catch(key)).toThrowError();
      expect(() => event.finally(key)).toThrowError();
    });
  });
  describe("emit 数量", function () {
    test("emit", function () {
      event.then(() => {});
      event.catch(() => {});
      expect(event.emit("data")).toBe(1);
    });
    test("emitError", function () {
      event.then(() => {});
      event.catch(() => {});
      expect(event.emitError(new Error("xx"))).toBe(1);
    });
  });
  test("取消订阅", function () {
    const thenFn = vi.fn();
    const finallyFn = vi.fn();
    const catchFn = vi.fn();
    event.then(thenFn);
    event.catch(catchFn);
    event.finally(finallyFn);

    event.off(thenFn);
    event.off(catchFn);
    event.off(finallyFn);

    expect(event.emit(1)).toBe(0);
  });
});
