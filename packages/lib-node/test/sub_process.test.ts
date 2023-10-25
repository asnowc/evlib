import { spawn, fork, exec } from "../src/process.js";
import { it, test, describe, vi, expect } from "vitest";
import { ReadableStream } from "node:stream/web";
import * as path from "node:path";
import { open } from "node:fs/promises";
import { readAll } from "@eavid/lib-node/stream";
import { resolve } from "node:path";

const nodeBin = process.execPath;
const dir = __dirname;

const childDir = "./__mocks__/child_process";
describe("spawn", function () {
    test("spawn", async function () {
        const args = [childDir + "/ab_child.mjs"];

        const file = await open(path.resolve(dir, args[0]));
        const process = await spawn(nodeBin, { cwd: dir, args, sharedResource: [file.fd], env: { FD_LIST: "[3]" } });
        const stdout = process.stdio[1]!;
        expect(stdout).instanceOf(ReadableStream);

        const res = readAll(stdout.getReader()).then((bufList): string => Buffer.concat(bufList).toString());

        expect(process.pid).toBeTypeOf("number");
        expect(process.spawnFile).toBe(nodeBin);
        expect(process.spawnargs).toEqual([nodeBin, ...args]);
        await expect(res).resolves.toBe("//ab_child\n[]\nfin\n");
        await process.$close;
        expect(process.closed).toBeTruthy();
    });
    test("kill", async function () {
        const process = await spawn(nodeBin, { env: {}, cwd: dir });
        process.kill(0);
        expect(process.closed).toBeTruthy();
    });
    test("通信协议", async function () {
        const process = await spawn(nodeBin, { env: {}, cwd: dir });
        expect(process.send("aa"), "通信协议未连接").rejects.toThrowError(
            "The communication protocol is not connected"
        );
        process.kill();
    });
});
const mockDir = resolve(dir, "__mocks__/child_process");
const jsFile = resolve(mockDir, "ab_child.mjs");
describe.skip("exec", function () {});
describe("fork", function () {
    test("fork", async function () {
        const sub = await fork(jsFile, { args: ["1", "2"] });
    });
});
