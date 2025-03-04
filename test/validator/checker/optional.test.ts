import { describe, expect, test } from "vitest";
import { checkType, optional, verifyType } from "evlib/validator";
import "../assests/type_check.assert.ts";
test("对象字段可选", function () {
  expect(
    checkType({ s: undefined }, { s: optional("number"), q: optional("string") }),
  ).checkPass();
  expect(
    checkType({ s: 1, q: "abc" }, { s: optional("number"), q: optional("string") }),
  ).checkPass();
  expect(
    checkType({ s: "abc" }, { s: optional("number") }),
  ).checkFailWithField(["s"]);
});
test("默认值", function () {
  expect(verifyType({}, { q: optional("string", undefined, 7) }).q).toEqual(7);

  expect(verifyType({ q: null }, { q: optional("string", null, 7) }).q).toEqual(7);
  expect(
    verifyType({ q: null, c: undefined, a: null }, {
      q: optional("string", null, 7),
      c: optional("string", "nullish", 7),
      a: optional("string", "nullish", 7),
    }),
  ).toEqual(
    {
      q: 7,
      c: 7,
      a: 7,
    },
  );
});
test("删除值为undefined且预期为可选类型的字段", function () {
  let object = { s: 3, q: undefined };
  expect(
    checkType(
      object,
      { s: "number", q: optional("string") },
      { policy: "delete" },
    ),
  ).checkPass();
  expect(object, "q应该被删除").not.has.key("q");
});
test("快捷可选", function () {
  expect(
    checkType(
      { s: 3, i: "s" },
      { s: "number", i: "string", q: optional.string },
    ),
  ).checkPass();
  expect(
    checkType(
      { s: 3, i: "s", q: 8 },
      { s: "number", i: "string", q: optional.string },
    ),
  ).checkFailWithField(["q"]);
  expect(
    checkType(
      { s: 3, i: "s", q: "sd" },
      { s: "number", i: "string", q: optional.string },
    ),
  ).checkPass();
});
