import { describe, expect, test, vi } from "vitest";
import { createObjectChain, getChainPath } from "evlib/object";

describe("create", function () {
  test("自定义工厂", function () {
    let i = 0;

    const factory = () => {
      let y = i++;
      return () => y;
    };
    const obj = createObjectChain(factory);

    expect(getChainPath(obj), "根路径").toEqual([]);

    const { c1, c2, c3 } = obj;
    expect(c1()).toBe(1);
    expect(c2()).toBe(2);
    expect(c3()).toBe(3);
  });

  test("指定跟路径", function () {
    const factory = vi.fn(() => ({}));
    const obj = createObjectChain("key", undefined, factory);
    expect(getChainPath(obj)).toEqual(["key"]);

    const o2 = createObjectChain("key2", obj);
    expect(getChainPath(o2), "继承创建").toEqual(["key", "key2"]);
  });
  test("默认工厂", function () {
    const obj = createObjectChain();
    const fn = obj.a.b.b;
    expect(fn).instanceof(Function);
  });
  test("工厂返回重复对象", function () {
    const fn = () => {};

    const c = createObjectChain("root", undefined, () => fn); //每次创建都返回相同的实例，这会造成异常

    expect(getChainPath(c)).toEqual(["root"]);
    expect(() => c.a).toThrowError();
    expect(() => c.a).toThrowError();
  });
});
test("调用", function () {
  const obj = createObjectChain(() => {
    return (...args: any[]) => args;
  });
  const [args, thisArg, target] = obj.a.b.c(1, 2, 3);
  expect(args).toEqual([1, 2, 3]);
  expect(getChainPath(target)).toEqual(["a", "b", "c"]);
});
test("修改属性", function () {
  const caller = createObjectChain();
  caller.att1 = 1 as any;
  expect(Object.keys(caller)).toEqual(["att1"]);
  expect(caller.att1).toBe(1);
});
