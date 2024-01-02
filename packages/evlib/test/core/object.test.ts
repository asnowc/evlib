import { patchObject, groupObject, pickObjectKey, removeUndefinedKey, deepClone } from "evlib";
import { describe, expect, test } from "vitest";

describe("deepClone", function () {
  test("基础", function () {
    const src = { a: { v: 1 }, b: { v: 2 } };
    const res = deepClone(src);
    expect(res).toEqual(src);
    expect(res).not.toBe(src);
    expect(res.a).not.toBe(src.a);
    expect(res.b).not.toBe(src.b);
  });
  test("复用", function () {
    const sub = { v: 1 };
    const src = { a: sub, b: sub };
    const res = deepClone(src);
    expect(res).toEqual(src);
    expect(res.a).toBe(res.b);
  });
  test("循环引用:object", function () {
    const sub1 = { sub2: undefined as any };
    const sub2 = { sub1 };
    sub1.sub2 = sub2;

    const src = { sub1, sub2 };
    const res = deepClone(src);
    expect(res.sub1.sub2).toBe(res.sub2);
    expect(res.sub2.sub1).toBe(res.sub1);
  });
  test("自身引用:object", function () {
    const src = { self: undefined as any };
    src.self = src;
    const res = deepClone(src);
    expect(res).toEqual(src);
    expect(res.self).toBe(res);
  });
  test("循环引用:array", function () {
    const sub1: any[] = [];
    const sub2 = [sub1];
    sub1[0] = sub2;

    const src = { sub1, sub2 };
    const res = deepClone(src);
    expect(res.sub1[0]).toBe(res.sub2);
    expect(res.sub2[0]).toBe(res.sub1);
  });
  test("自身引用:array", function () {
    const src: any[] = [];
    src[0] = src;
    const res = deepClone(src);
    expect(res).toEqual(src);
    expect(res[0]).toBe(res);
  });
});

describe("patchObject", function () {
  test("返回值", function () {
    const form = { a: "f_a", b: "f_b" },
      to = { a: "to_a", b: "to_b" };

    const res = patchObject(form, to);
    expect(res).toBe(to);
    expect(res).toEqual(form);
  });
  test("深度覆盖", function () {
    const form = { a: "form", extra: {}, d1: {}, d2: { a: "form", extra: "to" } },
      to = { a: "to", d1: { q: "to" }, d2: { a: "to", b: "to" } };

    patchObject(form, to);
    expect(to).toEqual({ a: "form", extra: {}, d1: { q: "to" }, d2: { a: "form", b: "to", extra: "to" } });
    expect((to as any).extra, "").not.toBe(form.extra);
  });
  test("对象替换值", function () {
    const form = { a: "form", b: undefined, extra: { a: "form" } },
      to = { a: "to", b: 8, extra: undefined };

    patchObject(form, to);
    expect(to).toEqual({ a: "form", b: undefined, extra: { a: "form" } });
    expect(to.extra, "整个对象覆盖时深度克隆").not.toBe(form.extra);
  });
  test("skipUndefined", function () {
    const form = { a: "form", b: undefined, extra: { a: "form" } },
      to = { a: "to", b: 8, extra: undefined };

    patchObject(form, to, { skipUndefined: true });
    expect(to).toEqual({ a: "form", b: 8, extra: { a: "form" } });
    expect(to.extra, "整个对象覆盖时深度克隆").not.toBe(form.extra);
  });
  test("值替换对象", function () {
    const form = { a: "form", extra: "e" },
      to = { a: "to", extra: { a: "form" } };
    expect(patchObject(form, to)).toEqual(form);
  });
  describe("合并数组", function () {
    const from = { arr: [1, 2, 3] };
    test("push", function () {
      const to = { arr: [4, 5] };
      const res = patchObject<typeof from>(from, to, { arrayStrategy: "push" });
      expect(res.arr).toEqual([4, 5, 1, 2, 3]);
      expect(res.arr).toBe(to.arr);
    });
    test("unshift", function () {
      const to = { arr: [4, 5] };
      const res = patchObject<typeof from>(from, to, { arrayStrategy: "unshift" });
      expect(res.arr).toEqual([1, 2, 3, 4, 5]);
      expect(res.arr).toBe(to.arr);
    });
    test("replace", function () {
      const to = { arr: [4, 5] };
      const res = patchObject<typeof from>(from, to);
      expect(res.arr).toBe(from.arr);
      expect(res.arr).toEqual([1, 2, 3]);
    });
  });

  test("仅覆盖可枚举键", function () {
    const form = { a: "f_a", b: "f_b" },
      to = { a: "to_a", b: "to_b" };
    Object.defineProperty(form, "a", { value: "f_a", enumerable: false });
    expect(patchObject(form, to)).toEqual({ a: "to_a", b: "f_b" });
  });
});
describe("removeUndefinedKey", function () {
  test("浅层删除", function () {
    const obj = { a: 0, c: null, d: undefined };
    const res = removeUndefinedKey(obj);
    expect(res).not.haveOwnProperty("d");
    expect(res).toEqual(obj);
  });
  test("深度删除", function () {
    const obj = { c: null, d: undefined, e: { q: undefined, b: null } };
    const res = removeUndefinedKey(obj, true);
    expect(res).not.haveOwnProperty("d");
    expect(res.e).not.haveOwnProperty("q");
  });
  test("循环引用", function () {
    const obj = { a: 1 as any, c: null, d: undefined };
    obj.a = obj;
    const res = removeUndefinedKey(obj);
    expect(res).not.haveOwnProperty("d");
    expect(res.a).toBe(obj);
  });
});
describe("pickObject", function () {
  test("pick", function () {
    const obj = { a: 1, b: "str", c: {} };
    expect(pickObjectKey(obj, ["a"])).toEqual({ a: 1 });
    expect(pickObjectKey(obj, ["a", "b"])).toEqual({ a: 1, b: "str" });
    expect(pickObjectKey(obj, ["c"]).c).toBe(obj.c);
  });
  test("pickTo", function () {
    const obj = { a: 1, b: "str", c: {} };
    const target = { a: 0 };
    expect(pickObjectKey(obj, ["a"], target)).toBe(target);
    expect(target.a).toBe(1);
  });
});
describe("groupObject", function () {
  test("基础分组", function () {
    const arr = [
      { a: "a", val: 1 },
      { a: "a", val: 2 },
      { a: "b", val: 3 },
      { a: "b", val: 4 },
      { a: "c", val: 5 },
    ];
    const res = groupObject(arr, "a");
    expect(res).toEqual({ a: [arr[0], arr[1]], b: [arr[2], arr[3]], c: [arr[4]] });
  });
});
