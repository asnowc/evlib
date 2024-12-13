import { listenSignal } from "evlib";
import { expect, test, vi } from "vitest";
test("dispose", function () {
  const cb = vi.fn();
  const abc = new AbortController();
  const listener = listenSignal(abc.signal, cb);
  listener.dispose();
  abc.abort();
  expect(cb).not.toBeCalled();
});

test("listen", function () {
  const cb = vi.fn(function (this: any) {
    return this;
  });
  const abc = new AbortController();
  listenSignal(abc.signal, cb);
  abc.abort();
  expect(cb, "abort 调用于 signal 上下文").toHaveReturnedWith(abc.signal);

  abc.abort();
  expect(cb, "只会被调用一次").toBeCalledTimes(1);
});
test("auto-remove-listen", function () {
  const cb = vi.fn();
  const abc = new AbortController();
  {
    using listen = listenSignal(abc.signal, cb);
  }
  abc.abort();
  expect(cb, "离开作用域后cb 已经被取消监听，调用 abort() 不会造成 cb 调用").not.toBeCalled();
});
