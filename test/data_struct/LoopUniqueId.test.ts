import { LoopUniqueId } from "evlib/data_struct";
import { expect, test } from "vitest";

test("LoopUniqueId", function () {
  const get = new LoopUniqueId(0, 5);
  for (let i = 0; i <= 5; i++) {
    expect(get.next()).toBe(i);
  }
  expect(get.next()).toBe(0);
});
