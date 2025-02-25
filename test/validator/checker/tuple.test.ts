import { expect, test } from "vitest";
import { checkType, tuple } from "evlib/validator";
import "../assests/type_check.assert.ts";

test("tuple 检测", function () {
  expect(checkType([2, "3"], tuple(["number", "string"]))).checkPass();
  expect(checkType([2], tuple(["number"]))).checkPass();
  expect(checkType([], tuple([]))).checkPass();

  expect(checkType([undefined], tuple([]))).checkFail();
  expect(checkType([2], tuple([]))).checkFail();

  expect(checkType([2, 3], tuple(["number"]))).checkFail();
  expect(checkType([2], tuple(["number", "string"]))).checkFail();
  expect(checkType(["2", "3"], tuple(["number", "string"]))).checkFail();
});
test("全匹配", function () {
  expect(checkType([1, "d"], tuple(["number", "string"]))).checkPass();

  expect(checkType([1, "d"], tuple(["number", "number"]))).checkFailWithField([
    "1",
  ]);
});
test("长度检测", function () {
  let val = [1, "d", null];
  expect(checkType(val, tuple(["number", "string"]))).checkFail({
    length: "预期长度: 2, 实际: 3",
  });
  expect(val).toEqual([1, "d", null]);
});
test("仅匹配预期提供字段", function () {
  let val = [1, "d", null];
  expect(
    checkType(val, tuple(["number", "string"]), { policy: "pass" }),
  ).checkPass();
  expect(val).toEqual([1, "d", null]);
});
test("移除多余", function () {
  let val = [1, "d", null];
  expect(
    checkType(val, tuple(["number", "string"]), { policy: "delete" }),
  ).checkPass();
  expect(val).toEqual([1, "d"]);
});
