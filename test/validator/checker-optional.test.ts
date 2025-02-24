import { describe, expect, test } from "vitest";
import { checkType, optional, verifyType } from "evlib/validator";
import "./assests/type_check.assert.ts";

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
    expect(verifyType({}, { q: optional("string", undefined, 7) }).q).toEqual(7);

    expect(verifyType({ q: null }, { q: optional("string", null, 7) }).q).toEqual(7);
    expect(
      verifyType({ q: null, c: undefined }, {
        q: optional("string", null, 7),
        c: optional("string", "nullish", 7),
      }),
    ).toEqual(
      {
        q: 7,
        c: 7,
      },
    );
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
