import { Listenable, createEvent } from "evlib";
import { describe, test, expect, vi, Mock } from "vitest";

describe("Listenable", function () {
  describe.each([() => new Listenable(), createEvent])("$constructor.name订阅", function (create) {
    test("订阅1个", function () {
      const listenable = create();
      const listener = vi.fn();
      expect(listenable.on(listener), "返回原函数").toBe(listener);
      expect(listenable.emit(1), "订阅者数量").toBe(1);
      expect(listener, "监听器触发1次").toBeCalledTimes(1);
      expect(listener, "监听器参数是1").toBeCalledWith(1);
    });
    test("订阅多个", function () {
      const listenable = new Listenable();
      let emit = 0;
      const implFn = () => emit++; //返回被执行时的顺序
      const listeners = [1, 2, 3, 4].map(() => {
        const listener = vi.fn(implFn);
        listenable.on(listener);
        return listener;
      });

      expect(listenable.count, "count").toBe(listeners.length);
      const data = Symbol();

      expect(listenable.emit(data), "订阅者数量").toBe(listeners.length);

      for (let i = 0; i < listeners.length; i++) {
        expect(listeners[i].mock.calls[0], "相同的调用参数-" + i).toEqual([data]);
        expect(listeners[i].mock.results[0].value, "按顺序调用-" + i).toBe(i);
      }
    });
    test("then", function () {
      const listenable = new Listenable();

      const once: Mock<[], boolean> = vi.fn(() => listenable.listening(once)); //return false
      const first = vi.fn(() => listenable.listening(once)); //return true
      const last = vi.fn(() => listenable.listening(once)); //return false
      listenable.on(first);
      listenable.then(once);
      listenable.on(last);
      expect(listenable.emit(null), "触发数量为3").toBe(3);

      expect(first.mock.results[0].value).toBe(true);
      expect(once.mock.results[0].value).toBe(false);
      expect(last.mock.results[0].value).toBe(false);

      expect(listenable.emit(null), "触发数量为2").toBe(2);
      expect(once, "仅触发1次").toBeCalledTimes(1);
      expect(last, "触发2次").toBeCalledTimes(2);
    });
    test("await", async function () {
      const listenable = new Listenable();
      const arg = Symbol();
      setTimeout(() => listenable.emit(arg));
      const res = await listenable;
      expect(res).toBe(arg);
    });
    test("触发中途取消订阅", function () {
      const listenable = new Listenable();
      const a = () => listenable.off(d);
      const c = () => {};
      const d = vi.fn();
      listenable.on(a);
      listenable.on(c);
      listenable.on(d);
      expect(d).not.toBeCalled();
    });
    test("then 之前已有订阅", function () {
      const listenable = new Listenable();
      const listener = vi.fn();
      listenable.on(listener);
      listenable.then(listener);
      listenable.emit(null);
      listenable.emit(null);
      listenable.emit(null);
      expect(listener).toBeCalledTimes(3);
    });
    test("重复订阅", function () {
      const listenable = new Listenable();
      const listener = vi.fn();
      listenable.on(listener);
      listenable.on(listener);
      expect(listenable.count).toBe(1);
      listenable.emit(1);
      expect(listener).toBeCalledTimes(1);
    });
  });
});
describe("EventController", function () {
  describe("异步订阅", function () {
    test("订阅1个", async function () {
      const listenable = createEvent();
      const res = listenable();
      expect(res, "返回原函数").instanceof(Promise);
      expect(listenable.emit(1), "订阅者数量").toBe(1);
      await expect(res).resolves.toBe(1);
    });
    test("订阅多个", async function () {
      const event = createEvent();
      const listeners = [1, 2, 3, 4].map(event);
      const data = Symbol();
      expect(event.emit(data), "订阅者数量").toBe(listeners.length);
      await expect(Promise.all(listeners)).resolves.toEqual([data, data, data, data]);
    });
    test("同步与异步同时监听", async function () {
      const listenable = createEvent();
      let i = 0;
      const fn3 = vi.fn(() => i++);
      const fn4 = vi.fn(() => i++);
      const fn1 = listenable.on(vi.fn(() => i++));
      const p1 = listenable().then(fn3);
      const fn2 = listenable.on(vi.fn(() => i++));
      const p2 = listenable().then(fn4);
      expect(listenable.emit(12)).toBe(4);
      await p2;
      expect(fn1.mock.results[0].value).toBe(0);
      expect(fn2.mock.results[0].value).toBe(1);
      expect(fn3.mock.results[0].value).toBe(2);
      expect(fn4.mock.results[0].value).toBe(3);
    });
  });
});
