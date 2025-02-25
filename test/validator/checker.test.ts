import { expect, test } from "vitest";
import { checkType, enumType, instanceOf, integer, numberRange, stringMatch, union } from "evlib/validator";
import "./assests/type_check.assert.ts";

test("union", function () {
  const res = checkType(
    { s: 3, i: null },
    {
      s: union(["number", "string"]),
      i: union(["string", (a: any) => undefined]),
    },
  );
  //联合类型
  expect(res).checkPass();
  expect(
    checkType({ s: 3 }, { s: union(["bigint", "string"]) }),
  ).checkFailWithField(["s"]);
});
test("numberRange", function () {
  let towToFour = numberRange(2, 4);
  expect(checkType({ a: 2 }, { a: towToFour })).checkPass();
  expect(checkType({ a: 3 }, { a: towToFour })).checkPass();
  expect(checkType({ a: 4 }, { a: towToFour })).checkPass();
  expect(checkType({ a: 5 }, { a: towToFour })).checkFailWithField(["a"]);
  expect(checkType({ a: 1 }, { a: towToFour })).checkFailWithField(["a"]);
  expect(checkType({ a: "d" }, { a: towToFour })).checkFailWithField(["a"]);
  expect(checkType({ a: undefined }, { a: towToFour })).checkFailWithField([
    "a",
  ]);
  expect(checkType({ a: new Set() }, { a: towToFour })).checkFailWithField([
    "a",
  ]);
});
test("instanceOf", function () {
  let mapIns = instanceOf(Map);
  expect(checkType({ a: new Map() }, { a: mapIns })).checkPass();
  expect(checkType({ a: null }, { a: mapIns })).checkFailWithField(["a"]);
  expect(checkType({ a: NaN }, { a: mapIns })).checkFailWithField(["a"]);
  expect(checkType({ a: undefined }, { a: mapIns })).checkFailWithField([
    "a",
  ]);
  expect(checkType({}, { a: mapIns })).checkFailWithField(["a"]);
});

test("enumTypes", function () {
  const exp = enumType([13, 2, 3]);
  expect(checkType(3, exp)).checkPass();
  expect(checkType(0, exp)).checkFail();
  expect(checkType("str", exp)).checkFail();
});
