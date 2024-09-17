import { describe, expect, test } from "vitest";
import { checkType, ExpectType, typeChecker } from "evlib";
import "./assests/type_check.assert.ts";
const {
  optional,
  array,
  instanceOf,
  numberRange,
  record,
  union,
  maybeNull,
  maybeNullish,
  enumType,
} = typeChecker;

describe("内置测试函数", function () {
  test("union", function () {
    const res = checkType(
      { s: 3, i: null },
      {
        s: union(["number", "string"]),
        i: union(["string", (a: any) => undefined]),
      },
    );
    //联合类型
    expect(res).toCheckPass();
    expect(
      checkType({ s: 3 }, { s: union(["bigint", "string"]) }),
    ).toCheckFailWithField(["s"]);
  });
  describe("optional", function () {
    describe("自定义可选", function () {
      test("不存在的可选", function () {
        expect(
          checkType({ s: 3 }, { s: "number", q: optional("string") }),
        ).toCheckPass();
      });
      test("错误的可选", function () {
        expect(
          checkType(
            { q: { c: 8 } },
            {
              q: optional({ c: "string" }),
            },
          ),
        ).toCheckFailWithField(["q"]);
      });
      test("正确的可选", function () {
        expect(
          checkType(
            { s: 3, q: "sd" },
            {
              s: "number",
              q: optional("string"),
            },
          ),
        ).toCheckPass();
      });
      test("默认值", function () {
        const { value } = checkType({}, {
          q: optional("string", 7),
        });
        expect(value.q).toEqual(7);
      });
    });
    test("删除值为undefined且预期为可选类型的字段", function () {
      let object = { s: 3, q: undefined };
      expect(
        checkType(
          object,
          { s: "number", q: optional("string") },
          { policy: "delete" },
        ),
      ).toCheckPass();
      expect(object, "q应该被删除").not.has.key("q");
    });
    test("快捷可选", function () {
      expect(
        checkType(
          { s: 3, i: "s" },
          { s: "number", i: "string", q: optional.string },
        ),
      ).toCheckPass();
      expect(
        checkType(
          { s: 3, i: "s", q: 8 },
          { s: "number", i: "string", q: optional.string },
        ),
      ).toCheckFailWithField(["q"]);
      expect(
        checkType(
          { s: 3, i: "s", q: "sd" },
          { s: "number", i: "string", q: optional.string },
        ),
      ).toCheckPass();
    });
  });
  test("numberRange", function () {
    let towToFour = numberRange(2, 4);
    expect(checkType({ a: 2 }, { a: towToFour })).toCheckPass();
    expect(checkType({ a: 3 }, { a: towToFour })).toCheckPass();
    expect(checkType({ a: 4 }, { a: towToFour })).toCheckPass();
    expect(checkType({ a: 5 }, { a: towToFour })).toCheckFailWithField(["a"]);
    expect(checkType({ a: 1 }, { a: towToFour })).toCheckFailWithField(["a"]);
    expect(checkType({ a: "d" }, { a: towToFour })).toCheckFailWithField(["a"]);
    expect(checkType({ a: undefined }, { a: towToFour })).toCheckFailWithField([
      "a",
    ]);
    expect(checkType({ a: new Set() }, { a: towToFour })).toCheckFailWithField([
      "a",
    ]);
  });
  test("instanceOf", function () {
    let mapIns = instanceOf(Map);
    expect(checkType({ a: new Map() }, { a: mapIns })).toCheckPass();
    expect(checkType({ a: null }, { a: mapIns })).toCheckFailWithField(["a"]);
    expect(checkType({ a: NaN }, { a: mapIns })).toCheckFailWithField(["a"]);
    expect(checkType({ a: undefined }, { a: mapIns })).toCheckFailWithField([
      "a",
    ]);
    expect(checkType({}, { a: mapIns })).toCheckFailWithField(["a"]);
  });
  describe("array", function () {
    test("数组array检测", function () {
      let res: CheckRes = checkType([2, 4, 56, 78], array.number);
      expect(res).toCheckPass();

      res = checkType([2, 4, "d", 78], array.number);
      expect(res).toCheckFailWithField(["2"]);
    });
    test("数组类型判断", function () {
      let res = checkType([2, 4, 56, 78], array("number"));
      expect(res).toCheckPass();

      res = checkType([2, 4, "d", 78], array("number"));
      expect(res).toCheckFailWithField(["2"]);
    });
    test("数组长度限制", function () {
      let res: CheckRes = checkType(
        { a: [2, 4, 56, 78] },
        { a: array("number", 2) },
        { policy: "delete" },
      );
      expect(res).toCheckPass();

      res = checkType([2, 4, 56, 78], array("number", 2));
      expect(res).toCheckFailWithField(["length"]);

      res = checkType([2, 4, "d", 78], array("number", 3), {
        checkAll: true,
      });
      expect(res).toCheckFailWithField(["2", "length"]);
    });
  });
  test("maybeNull", function () {
    const exp = {
      a: maybeNull("number"),
      b: maybeNull("number"),
    } satisfies ExpectType;
    const res = checkType({ a: 3, b: null }, exp);
    expect(res).toCheckPass();
  });
  test("maybeNull默认值", function () {
    const exp = {
      a: maybeNull("number", 88),
      b: maybeNull("number", 99),
    } satisfies ExpectType;
    const { value } = checkType({ a: 3, b: null }, exp);
    expect(value).toEqual({ a: 3, b: 99 });
  });
  test("maybeNullish", function () {
    const exp = {
      a: maybeNullish("number"),
      b: maybeNullish("number"),
      c: maybeNullish("number"),
    } satisfies ExpectType;

    // 忽略 d
    let res = checkType({ a: 3, b: null, c: undefined }, exp);
    expect(res).toCheckPass();

    // 不能忽略
    let res2 = checkType(
      {},
      {
        c: maybeNullish("number", false),
      },
    );
    expect(res2).toCheckFail();

    // 可忽略
    let res3 = checkType(
      {},
      {
        c: maybeNullish("number"),
      },
    );
    expect(res3).toCheckPass();
  });
  test("maybeNullish默认值", function () {
    // 可忽略
    let { value } = checkType(
      { a: null },
      {
        a: maybeNullish("number", true, 8),
        c: maybeNullish("number", true, 9),
      },
    );
    expect(value).toEqual({ a: 8, c: 9 });
  });
  test("enumTypes", function () {
    const exp = enumType([13, 2, 3]);
    expect(checkType(3, exp)).toCheckPass();
    expect(checkType(0, exp)).toCheckFail();
    expect(checkType("str", exp)).toCheckFail();
  });
});
describe("自定义校验函数", function () {
  test("使用自定义函数判断", function () {
    let obj = { s: 3, i: "s" };
    expect(
      checkType(obj, { s: "number", i: (a: any) => ({ error: "sd" }) }),
    ).toCheckFail({ i: "sd" });
    expect(
      checkType(obj, { s: "number", i: (a: any) => undefined }),
    ).toCheckPass();
  });
  test("转换值", function () {
    const obj = 10;
    const { value, error } = checkType(obj, (val) => {
      return { value: val / 2, replace: true };
    });
    expect(value, "值已被替换成").toBe(5);
    expect(error).toBeUndefined();
  });
  test("对象属性替换", function () {
    const obj = { aa: 10 };
    const { value, error } = checkType(obj, {
      aa: (val) => {
        return { value: val / 2, replace: true };
      },
    });
    expect(value.aa, "值已被替换成").toBe(5);
    expect(error).toBeUndefined();
  });
  test("record属性替换", function () {
    const obj = { aa: 10 };
    const { value, error } = checkType(
      obj,
      record((val) => ({ value: val / 2, replace: true })),
    );
    expect(value.aa, "值已被替换成").toBe(5);
    expect(error).toBeUndefined();
  });
  test("数组替换", function () {
    const obj = [10, 20];
    const { value, error } = checkType(
      obj,
      array((val: any) => ({
        value: val / 2,
        replace: true,
      })),
    );
    expect(value, "值已被替换成").toEqual([5, 10]);
    expect(error).toBeUndefined();
  });
  test("元组替换", function () {
    const obj = [10, 20];
    const { value, error } = checkType(obj, [
      "number",
      () => ({ value: 10, replace: true }),
    ]);
    expect(value, "值已被替换成").toEqual([10, 10]);
    expect(error).toBeUndefined();
  });
  test("校验不通过", function () {
    const obj = 9;
    const { value, error } = checkType(obj, (val) => ({
      error: "xxx",
    }));
    expect(value, "值已被替换成8").toBe(9);
    expect(error).toBe("xxx");
  });
});
type CheckRes<T = any> = {
  error?: any;
  /** 要替换的值 */
  value: T;
};
