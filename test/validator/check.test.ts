import { describe, expect, it, test } from "vitest";
import { checkType } from "evlib/validator";
import "./assests/type_check.assert.ts";
describe("基础类型检测", function () {
  it("null", function () {
    expect(checkType(null, "null")).checkPass();
    expect(checkType(null, {})).checkFail();
  });
  it("object", function () {
    expect(checkType({}, "object")).checkPass();
  });
  it("symbol", function () {
    expect(checkType(Symbol(), "symbol")).checkPass();
  });
});
describe("检测对象", function () {
  it("基本", function () {
    let obj = { s: 3, i: "s", q: undefined };
    expect(
      checkType(obj, { s: "number", i: "string", q: "undefined" }),
    ).checkPass();
    expect(obj).toEqual({ s: 3, i: "s", q: undefined });
  });
  it("移除多余", function () {
    let obj = { s: 3, i: "s", q: undefined };
    let checkRes = checkType(
      obj,
      { s: "number", i: "string" },
      { policy: "delete" },
    );
    expect(checkRes).checkPass();
    expect(obj).toEqual({ s: 3, i: "s" });
  });
  it("仅匹配", function () {
    let obj = { s: 3, i: "s", q: undefined };
    let checkRes = checkType(
      obj,
      { s: "number", i: "string" },
      { policy: "delete" },
    );
    expect(checkRes).checkPass();
    expect(obj).toEqual({ s: 3, i: "s", q: undefined });
  });
  it("多余字段检测", function () {
    let obj = { s: 3, i: "s", q: undefined };
    let checkRes = checkType(obj, { s: "number", i: "string" });
    expect(checkRes).checkFail({ q: "预期: 不存在, 实际: 存在" });
    expect(obj).toEqual({ s: 3, i: "s", q: undefined });
  });
  it("检测所有字段", function () {
    let obj = { s: 3, i: "s", q: undefined };
    let checkRes = checkType(
      obj,
      { s: "number", i: "string", q: "number", y: "number" },
      { checkAll: true },
    );
    expect(checkRes.error).has.keys(["q", "y"]);
    expect(obj).toEqual({ s: 3, i: "s", q: undefined });
  });
  it("检测不通过就跳出", function () {
    let obj = { s: 3, i: "s", q: undefined };
    let checkRes = checkType(
      obj,
      { s: "number", i: "string", q: "number", y: "number" },
      { checkAll: false },
    );
    let checkRes2 = checkType(obj, {
      s: "number",
      i: "string",
      q: "number",
      y: "number",
    });
    expect(checkRes).checkFailWithField(["q"]);
    expect(checkRes2).checkFailWithField(["q"]);
    expect(obj).toEqual({ s: 3, i: "s", q: undefined });
  });

  it("预期类型不一致", function () {
    let obj = { s: 3, y: null, q: undefined };
    expect(
      checkType(
        obj,
        { s: "string", y: {}, q: "undefined" },
        { checkAll: true },
      ),
      "预期类型不一致",
    ).checkFailWithField(["s", "y"]);
    expect(
      checkType(obj, { s: "string", y: (a: any) => undefined }),
      "预期类型不一致",
    ).checkFailWithField(["s"]);
  });
  it("预期不存在", function () {
    let res = checkType({ a: 8 }, { a: "number", b: "number" });
    expect(res).checkFailWithField(["b"]);
  });
  it("判断null类型", function () {
    let res = checkType({ a: null }, { a: "null" });
    expect(res).checkPass();
  });
  it("传入错误预期类型", function () {
    let res = checkType({ a: 3 }, { a: "D" } as any);
    expect(res).checkFailWithField(["a"]);
  });
});

describe("嵌套", function () {
  it("仅检测", function () {
    let res = checkType(
      { s: 3, i: { q: "s", c: undefined } },
      { s: "number", i: { q: "string", c: "undefined" } },
    );
    expect(res).checkPass();
  });
  it("删除多余", function () {
    let obj = { s: 3, i: { q: "s", y: null, c: undefined }, b: 6 };
    let res = checkType(
      obj,
      { s: "number", i: { q: "string", c: "undefined" } },
      { policy: "delete" },
    );
    expect(res).checkPass();
    expect(obj).toEqual({ s: 3, i: { q: "s", c: undefined } });
  });
});

test("union", function () {
  expect(checkType(null, ["string", "null"])).checkPass();
  expect(checkType(undefined, ["string", "null"])).checkFail();
  expect(checkType(
    { s: 3, i: null },
    { s: ["number", "string"], i: ["string", "null"] },
  )).checkPass();
  expect(
    checkType({ s: 3 }, { s: ["bigint", "string"] }),
  ).checkFailWithField(["s"]);
});
