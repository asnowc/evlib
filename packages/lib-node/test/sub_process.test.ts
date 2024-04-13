import { spawn, fork, exec, NodeSubProcess } from "@eavid/lib-node/sub_process";
import { it, test, describe, vi, expect } from "vitest";
import { ReadableStream } from "node:stream/web";
import * as path from "node:path";
import { open } from "node:fs/promises";
import { readAllFromStream } from "@eavid/lib-node/stream";
import { resolve } from "node:path";

const nodeBin = process.execPath;
const dir = __dirname;

const mockDir = resolve(dir, "__mocks__/child_process");
const jsFile = resolve(mockDir, "ab_child.mjs");
describe("spawn", function () {
  test("spawn", async function () {
    const args = [jsFile];

    const file = await open(path.resolve(dir, args[0]));
    const process = await spawn(nodeBin, {
      cwd: dir,
      args,
      sharedResource: [file.fd],
      env: { FD_LIST: "[3]" },
    });
    const stdout = process.stdout!;
    expect(stdout).instanceOf(ReadableStream);

    const res = readAllFromStream(stdout).then((bufList): string =>
      Buffer.concat(bufList).toString(),
    );

    expect(process.pid).toBeTypeOf("number");
    expect(process.spawnFile).toBe(nodeBin);
    expect(process.spawnargs).toEqual([nodeBin, ...args]);
    await expect(res).resolves.toBe("//ab_child\n[]\nfin\n"); // fd 发送成功, 读取到文件
    await process.watchClose();
    expect(process.closedState).toEqual({ code: 0, signal: null });
    expect(process.closed).toBeTruthy();
  });
  test("kill", async function () {
    const process = await spawn(nodeBin, { env: {}, cwd: dir });
    process.kill(0);
    expect(process.killed).toBeTruthy();
  });
});

const forkMockFile = resolve(mockDir, "fork.mjs");
describe("fork", function () {
  test("fork", async function () {
    const sub = await fork(forkMockFile, { args: ["1", "2"] });

    setTimeout(() => {
      sub.send("123");
      sub.send(true);
      sub.send(1);
      sub.send("exit");
    });
    const pms = readAllMessage(sub);
    await sub.watchClose();
    expect(sub.closedState).toMatchObject({ code: 0 });
    await expect(pms).resolves.toEqual(["123", true, 1]);
  });
});

async function readAllMessage(process: NodeSubProcess) {
  let list: unknown[] = [];
  function onMsg(msg: any) {
    list.push(msg);
  }
  process.$message.on(onMsg);
  await process.watchDisconnect();
  process.$message.off(onMsg);
  return list;
}
