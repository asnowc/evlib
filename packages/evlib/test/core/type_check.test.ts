import { it, expect, describe } from "vitest";
import { checkType, typeChecker } from "evlib";
import "./assests/type_check.assert.js";
const optional = typeChecker.optional;
describe("基本", function () {
  describe("基础类型检测", function () {
    it("null", function () {
      expect(checkType(null, "null")).toCheckPass();
      expect(checkType(null, {})).toCheckFail();
    });
    it("object", function () {
      expect(checkType({}, "object")).toCheckPass();
    });
    it("symbol", function () {
      expect(checkType(Symbol(), "symbol")).toCheckPass();
    });
  });
  describe("检测对象", function () {
    it("基本", function () {
      let obj = { s: 3, i: "s", q: undefined };
      expect(checkType(obj, { s: "number", i: "string", q: "undefined" })).toCheckPass();
      expect(obj).toEqual({ s: 3, i: "s", q: undefined });
    });
    it("移除多余", function () {
      let obj = { s: 3, i: "s", q: undefined };
      let checkRes = checkType(obj, { s: "number", i: "string" }, { policy: "delete" });
      expect(checkRes).toCheckPass();
      expect(obj).toEqual({ s: 3, i: "s" });
    });
    it("仅匹配", function () {
      let obj = { s: 3, i: "s", q: undefined };
      let checkRes = checkType(obj, { s: "number", i: "string" }, { policy: "delete" });
      expect(checkRes).toCheckPass();
      expect(obj).toEqual({ s: 3, i: "s", q: undefined });
    });
    it("多余字段检测", function () {
      let obj = { s: 3, i: "s", q: undefined };
      let checkRes = checkType(obj, { s: "number", i: "string" });
      expect(checkRes).toCheckFail({ q: "预期: 不存在, 实际: 存在" });
      expect(obj).toEqual({ s: 3, i: "s", q: undefined });
    });
    it("检测所有字段", function () {
      let obj = { s: 3, i: "s", q: undefined };
      let checkRes = checkType(obj, { s: "number", i: "string", q: "number", y: "number" }, { checkAll: true });
      expect(checkRes.error).has.keys(["q", "y"]);
      expect(obj).toEqual({ s: 3, i: "s", q: undefined });
    });
    it("检测不通过就跳出", function () {
      let obj = { s: 3, i: "s", q: undefined };
      let checkRes = checkType(obj, { s: "number", i: "string", q: "number", y: "number" }, { checkAll: false });
      let checkRes2 = checkType(obj, { s: "number", i: "string", q: "number", y: "number" });
      expect(checkRes).toCheckFailWithField(["q"]);
      expect(checkRes2).toCheckFailWithField(["q"]);
      expect(obj).toEqual({ s: 3, i: "s", q: undefined });
    });

    it("使用自定义函数判断", function () {
      let obj = { s: 3, i: "s" };
      expect(checkType(obj, { s: "number", i: (a: any) => ({ error: "sd" }) })).toCheckFail({ i: "sd" });
      expect(checkType(obj, { s: "number", i: (a: any) => undefined })).toCheckPass();
    });
    it("预期类型不一致", function () {
      let obj = { s: 3, y: null, q: undefined };
      expect(
        checkType(obj, { s: "string", y: {}, q: "undefined" }, { checkAll: true }),
        "预期类型不一致"
      ).toCheckFailWithField(["s", "y"]);
      expect(checkType(obj, { s: "string", y: (a: any) => undefined }), "预期类型不一致").toCheckFailWithField(["s"]);
    });
    it("预期不存在", function () {
      let res = checkType({ a: 8 }, { a: "number", b: "number" });
      expect(res).toCheckFailWithField(["b"]);
    });
    it("判断null类型", function () {
      let res = checkType({ a: null }, { a: "null" });
      expect(res).toCheckPass();
    });
    it("传入错误预期类型", function () {
      let res = checkType({ a: 3 }, { a: "D" } as any);
      expect(res).toCheckFailWithField(["a"]);
    });
  });
  describe("元组检测", function () {
    it("全匹配", function () {
      expect(checkType([1, "d"], ["number", "string"])).toCheckPass();

      expect(checkType([1, "d"], ["number", "number"])).toCheckFailWithField(["1"]);
    });
    it("长度检测", function () {
      let val = [1, "d", null];
      expect(checkType(val, ["number", "string"])).toCheckFail({ length: "预期长度: 2, 实际: 3" });
      expect(val).toEqual([1, "d", null]);
    });
    it("仅匹配预期提供字段", function () {
      let val = [1, "d", null];
      expect(checkType(val, ["number", "string"], { policy: "pass" })).toCheckPass();
      expect(val).toEqual([1, "d", null]);
    });
    it("移除多余", function () {
      let val = [1, "d", null];
      expect(checkType(val, ["number", "string"], { policy: "delete" })).toCheckPass();
      expect(val).toEqual([1, "d"]);
    });
  });
});
describe("嵌套", function () {
  it("仅检测", function () {
    let res = checkType({ s: 3, i: { q: "s", c: undefined } }, { s: "number", i: { q: "string", c: "undefined" } });
    expect(res).toCheckPass();
  });
  it("删除多余", function () {
    let obj = { s: 3, i: { q: "s", y: null, c: undefined }, b: 6 };
    let res = checkType(obj, { s: "number", i: { q: "string", c: "undefined" } }, { policy: "delete" });
    expect(res).toCheckPass();
    expect(obj).toEqual({ s: 3, i: { q: "s", c: undefined } });
  });
});

describe("内置测试函数", function () {
  it("联合类型", function () {
    //联合类型
    expect(
      checkType(
        { s: 3, i: null },
        {
          s: typeChecker.union(["number", "string"]),
          i: typeChecker.union(["string", (a) => undefined]),
        }
      )
    ).toCheckPass();
    expect(checkType({ s: 3 }, { s: typeChecker.union(["bigint", "string"]) })).toCheckFailWithField(["s"]);
  });
  describe("可选", function () {
    describe("自定义可选", function () {
      it("不存在的可选", function () {
        expect(checkType({ s: 3 }, { s: "number", q: optional("string") })).toCheckPass();
      });
      it("正确的可选", function () {
        expect(checkType({ s: 3, q: 8 }, { s: "number", q: optional("string") })).toCheckFailWithField(["q"]);
      });
      it("错误的可选", function () {
        expect(checkType({ s: 3, q: "sd" }, { s: "number", q: optional("string") })).toCheckPass();
      });
    });
    it("删除值为undefined且预期为可选类型的字段", function () {
      let object = { s: 3, q: undefined };
      expect(checkType(object, { s: "number", q: optional("string") }, { policy: "delete" })).toCheckPass();
      expect(object, "q应该被删除").not.has.key("q");
    });
    it("快捷可选", function () {
      expect(checkType({ s: 3, i: "s" }, { s: "number", i: "string", q: optional.string })).toCheckPass();
      expect(checkType({ s: 3, i: "s", q: 8 }, { s: "number", i: "string", q: optional.string })).toCheckFailWithField([
        "q",
      ]);
      expect(checkType({ s: 3, i: "s", q: "sd" }, { s: "number", i: "string", q: optional.string })).toCheckPass();
    });
  });
  it("数字范围", function () {
    let towToFour = typeChecker.numberRange(2, 4);
    expect(checkType({ a: 2 }, { a: towToFour })).toCheckPass();
    expect(checkType({ a: 3 }, { a: towToFour })).toCheckPass();
    expect(checkType({ a: 4 }, { a: towToFour })).toCheckPass();
    expect(checkType({ a: 5 }, { a: towToFour })).toCheckFailWithField(["a"]);
    expect(checkType({ a: 1 }, { a: towToFour })).toCheckFailWithField(["a"]);
    expect(checkType({ a: "d" }, { a: towToFour })).toCheckFailWithField(["a"]);
    expect(checkType({ a: undefined }, { a: towToFour })).toCheckFailWithField(["a"]);
    expect(checkType({ a: new Set() }, { a: towToFour })).toCheckFailWithField(["a"]);
  });
  it("实例类型", function () {
    let mapIns = typeChecker.instanceof(Map);
    expect(checkType({ a: new Map() }, { a: mapIns })).toCheckPass();
    expect(checkType({ a: null }, { a: mapIns })).toCheckFailWithField(["a"]);
    expect(checkType({ a: NaN }, { a: mapIns })).toCheckFailWithField(["a"]);
    expect(checkType({ a: undefined }, { a: mapIns })).toCheckFailWithField(["a"]);
    expect(checkType({}, { a: mapIns })).toCheckFailWithField(["a"]);
  });
  describe("数组类型判断", function () {
    it("数组array检测", function () {
      let res: CheckRes = checkType([2, 4, 56, 78], typeChecker.array.number);
      expect(res).toCheckPass();

      res = checkType([2, 4, "d", 78], typeChecker.array.number);
      expect(res).toCheckFailWithField(["2"]);
    });
    it("数组类型判断", function () {
      let res = checkType([2, 4, 56, 78], typeChecker.arrayType("number"));
      expect(res).toCheckPass();

      res = checkType([2, 4, "d", 78], typeChecker.arrayType("number"));
      expect(res).toCheckFailWithField(["2"]);
    });
    it("数组长度限制", function () {
      let res: CheckRes = checkType(
        { a: [2, 4, 56, 78] },
        { a: typeChecker.arrayType("number", 2) },
        { policy: "delete" }
      );
      expect(res).toCheckPass();

      res = checkType([2, 4, 56, 78], typeChecker.arrayType("number", 2));
      expect(res).toCheckFailWithField(["length"]);

      res = checkType([2, 4, "d", 78], typeChecker.arrayType("number", 3), { checkAll: true });
      expect(res).toCheckFailWithField(["2", "length"]);
    });
  });
});
type CheckRes<T = any> = {
  error?: any;
  /** 要替换的值 */
  value: T;
};
