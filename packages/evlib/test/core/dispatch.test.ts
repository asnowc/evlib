import { afterTime } from "evlib";
import { describe, it, vi, expect } from "vitest";

describe("afterTimeHandle", function () {
  it("超时成功", async function () {
    await expect(afterTime(100)).resolves.toBeUndefined();
  });
});
