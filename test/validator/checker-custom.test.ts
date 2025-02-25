import { expect, test } from "vitest";
import { array, checkType, record } from "evlib/validator";
import "./assests/type_check.assert.ts";

test("使用自定义函数判断", function () {
  let obj = { s: 3, i: "s" };
  expect(
    checkType(obj, { s: "number", i: (a: any) => ({ error: "sd" }) }),
  ).checkFail({ i: "sd" });
  expect(
    checkType(obj, { s: "number", i: (a: any) => undefined }),
  ).checkPass();
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
