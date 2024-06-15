import { randomString } from "evlib/mock";

import { expect, test } from "vitest";

test("len", function () {
  expect(randomString(5).length).toBe(5);
  expect(randomString(0).length).toBe(0);
  expect(() => randomString(-1)).toThrowError(RangeError);
});
