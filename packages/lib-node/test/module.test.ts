import { paseModMeta, ModuleMeta } from "@eavid/lib-node/module";
import { expect, describe, test } from "vitest";
import path from "node:path";

describe("paseModMeta", function () {
  test("file协议解析", function () {
    if (process.platform === "win32") {
      const res = paseModMeta({ url: "file:///c:/xx/q.ts" });
      expect(res).toMatchObject({
        dirname: path.resolve("c:/xx/"),
        filename: path.resolve("c:/xx/q.ts"),
        pathname: "/c:/xx/q.ts",
        protocol: "file:",
      } as ModuleMeta);
    } else {
      const res = paseModMeta({ url: "file:///xx/q.ts" });
      expect(res).toMatchObject({
        dirname: "/xx",
        filename: "/xx/q.ts",
        pathname: "/xx/q.ts",
        protocol: "file:",
      } as ModuleMeta);
    }
  });
  test("http协议解析", function () {
    const res = paseModMeta({ url: "http://xx.xx:892/sd/q.ts?query=xxx" });
    expect(res).toMatchObject({
      dirname: path.resolve("/sd"),
      filename: path.resolve("/sd/q.ts"),
      pathname: "/sd/q.ts",
      protocol: "http:",
    } as ModuleMeta);
  });
  test("中文解码", function () {
    const { href } = new URL("http://xx.xx/中/中文.ts");
    const res = paseModMeta({ url: href });

    expect(res).toMatchObject({
      dirname: path.resolve("/中"),
      filename: path.resolve("/中/中文.ts"),
      pathname: "/中/中文.ts",
      protocol: "http:",
    } as ModuleMeta);
  });
});
