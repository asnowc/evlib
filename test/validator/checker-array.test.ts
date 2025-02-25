import { expect, test } from "vitest";
import { array, checkType, type TypeCheckResult } from "evlib/validator";
import "./assests/type_check.assert.ts";

test("数组array检测", function () {
  let res: TypeCheckResult = checkType([2, 4, 56, 78], array.number);
  expect(res).checkPass();

  res = checkType([2, 4, "d", 78], array.number);
  expect(res).checkFailWithField(["2"]);
});
test("数组类型判断", function () {
  let res = checkType([2, 4, 56, 78], array("number"));
  expect(res).checkPass();

  res = checkType([2, 4, "d", 78], array("number"));
  expect(res).checkFailWithField(["2"]);
});
test("数组长度限制", function () {
  let res1 = checkType(
    { a: [2, 4, 56, 78] },
    { a: array("number", { maxLen: 2 }) },
    { policy: "delete" },
  );
  expect(res1).checkPass();
  expect(res1.value.a).toHaveLength(2);
  let res = checkType([2, 4, 56, 78], array("number", { maxLen: 2 }));
  expect(res).checkFailWithField(["length"]);

  res = checkType([2, 4, "d", 78], array("number", { maxLen: 3 }), {
    checkAll: true,
  });
  expect(res).checkFailWithField(["2", "length"]);
});
test("传入非数组", function () {
  let res: TypeCheckResult = checkType(null, array.number);
  expect(res).checkFail();
});
