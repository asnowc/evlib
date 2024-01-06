import { paseModMeta } from "evlib";
import { expect, describe, test } from "vitest";
const { filename } = paseModMeta(import.meta);
console.log(filename);

describe("paseModMeta", function () {
  test("file协议解析", function () {
    const { dirname, filename } = paseModMeta({ url: "file:///sd/q.ts" });
    expect(dirname).toBe("/sd");
    expect(filename).toBe("/sd/q.ts");
  });
  test("http协议解析", function () {
    const { dirname, filename } = paseModMeta({ url: "http://xx.xx:892/sd/q.ts?query=xxx" });
    expect(dirname).toBe("/sd");
    expect(filename).toBe("/sd/q.ts");
  });
  test("http协议解析", function () {
    const { href } = new URL("http://xx.xx/中/中文.ts");
    const { dirname, filename } = paseModMeta({ url: href });
    expect(dirname).toBe("/中");
    expect(filename).toBe("/中/中文.ts");
  });
});
