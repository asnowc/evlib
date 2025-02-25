import { expect, test } from "vitest";
import { checkType, integer } from "evlib/validator";
import "./assests/type_check.assert.ts";

test("integer", function () {
  expect(checkType(NaN, integer())).not.checkPass();
  expect(checkType(Infinity, integer())).not.checkPass();
  expect(checkType(-Infinity, integer())).not.checkPass();
  expect(checkType("1", integer())).not.checkPass();
  expect(checkType(true, integer())).not.checkPass();

  expect(checkType(2, integer())).checkPass();
});
test("integer-range", function () {
  expect(checkType(-1, integer(0))).not.checkPass();
  expect(checkType(9, integer(0))).checkPass();

  expect(checkType(9, integer(0, 10))).checkPass();
  expect(checkType(11, integer(0, 10))).not.checkPass();
  expect(checkType(NaN, integer(0, 10))).not.checkPass();
  expect(checkType(Infinity, integer(0, 10))).not.checkPass();

  expect(checkType("56", integer({ acceptString: true }))).checkPass();
  expect(checkType("3", integer({ max: 2, acceptString: true }))).not.checkPass();
  expect(checkType("3", integer({ min: 5, acceptString: true }))).not.checkPass();
  expect(checkType("3", integer({ min: 0, max: 10, acceptString: true }))).checkPass();
});
