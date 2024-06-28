import { createList } from "evlib/mock";

import { expect, test } from "vitest";

test("create", function () {
  const list = createList((i) => i, 10);
  expect(list.length).toBe(10);
  expect(list[2]).toBe(2);
});
