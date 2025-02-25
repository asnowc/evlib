import { expect, test } from "vitest";
import { checkType, stringMatch } from "evlib/validator";
import "../assests/type_check.assert.ts";

test("integer", function () {
  expect(checkType(123, stringMatch(/123/))).not.checkPass();
  expect(checkType("123", stringMatch(/123/))).checkPass();
  expect(checkType(undefined, stringMatch(/123/))).not.checkPass();
});
