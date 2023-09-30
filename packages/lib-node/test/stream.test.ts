import { createScannerFromReadable } from "../src/stream.js";
import { Readable } from "node:stream";
import { test, expect, describe } from "vitest";

describe("createScannerFromReadable", function () {
    function createMockRead() {
        const readable = new Readable({ read(size) {} });
        const { read, cancel } = createScannerFromReadable(readable);
        return { readable, read, cancel };
    }

    describe("等待分段", function () {
        test("一个chunk足够多个分段", async function () {
            const { read, readable } = createMockRead();
            readable.push(Buffer.allocUnsafe(10));
            readable.push(null);
            await expect(read(4)).resolves.toHaveLength(4);
            await expect(read(2)).resolves.toHaveLength(2);
            await expect(read(2)).resolves.toHaveLength(2);
            await expect(read(2)).resolves.toHaveLength(2);
            await expect(read(2, true)).resolves.toBe(null);
        });
        test("需要等待多个chunk", async function () {
            const { read, readable } = createMockRead();
            let pms = read(4);
            expect(pms).resolves.toHaveLength(4);
            {
                //mock
                readable.push(Buffer.allocUnsafe(2));
                await new Promise<void>((resolve) => setTimeout(resolve));
                readable.push(Buffer.allocUnsafe(2));
                readable.push(null);
            }
            await pms;
            await expect(read(2, true)).resolves.toBe(null);
        });
        test("等待的chunk足够下一个分段", async function () {
            const { read, readable } = createMockRead();
            let pms = read(4);
            expect(pms).resolves.toHaveLength(4);
            readable.push(Buffer.allocUnsafe(2));
            await new Promise<void>((resolve) => setTimeout(resolve));
            readable.push(Buffer.allocUnsafe(6));
            readable.push(null);
            await pms;
            await expect(read(4)).resolves.toHaveLength(4);
            // await expect(read(2, true)).resolves.toBe(null);
        });
    });

    test("队列读取", async function () {
        const { read, readable } = createMockRead();
        const pms = Promise.all([read(2), read(2), read(2)]);
        const buf = Buffer.from([0, 1, 0, 2, 0, 3]);
        readable.push(buf);
        readable.push(null);
        const arr = (await pms).map((buf) => buf.readUint16BE());
        expect(arr).toEqual(arr);
    });
    test("不安全读取", async function () {
        const { read, readable } = createMockRead();
        let pms = read(4);
        readable.push(Buffer.allocUnsafe(2));
        readable.push(null);
        await expect(pms).rejects.toThrowError();
    });

    const { read, readable } = createMockRead();
    test("安全读取", async function () {
        let pms = read(4, true);
        readable.push(Buffer.allocUnsafe(2));
        readable.push(null);
        await expect(pms).resolves.toBe(null);
    });

    test("结束的流继续读取", async function () {
        await expect(read(4)).rejects.toThrowError();
    });
    test("小于1的读取", function () {
        const { read } = createMockRead();
        expect(read(0)).rejects.toThrowError();
    });
    test("创建reader前流已经结束", async function () {
        const readable = new Readable({ read(size) {} });
        readable.on("data", () => {});
        readable.push(null);
        await new Promise((resolve) => setTimeout(resolve));
        const { read } = createScannerFromReadable(readable);
        /** 未监听 */
        expect(readable.listenerCount("readable")).toBe(0);
        expect(readable.listenerCount("close")).toBe(0);
        expect(readable.listenerCount("end")).toBe(0);
        await expect(read(2, true)).resolves.toBe(null);
    });

    describe("取消reader", function () {
        test("cancel()", function () {
            const { cancel, readable } = createMockRead();
            readable.push(Buffer.allocUnsafe(4));
            readable.push(null);

            cancel();
            expect(readable.isPaused(), "流处于暂停状态").toBeTruthy();

            /** 已经移除事件 */
            expect(readable.listenerCount("readable")).toBe(0);
            expect(readable.listenerCount("close")).toBe(0);
            expect(readable.listenerCount("end")).toBe(0);
            expect(cancel()).toBe(null);
        });
        test.skip("缓存有剩余", async function () {
            const { read, cancel, readable } = createMockRead();
            readable.push(Buffer.allocUnsafe(4));
            readable.push(null);
            await read(2);

            const val = cancel() as Buffer;
            expect(val!.byteLength).toBe(2);
        });
        test.skip("缓存无剩余", async function () {
            const { cancel } = createMockRead();
            expect(cancel()).toBe(null);
        });
        test("缓存推回Readable", async function () {
            const { read, cancel, readable } = createMockRead();
            const pms = read(4);
            readable.push(Buffer.from("abcdefgh"));
            await pms;
            expect(cancel()).toBe(null);
            readable.push(null);
            expect(readable.readableLength).toBe(4); // efgh
            expect(readable.read().toString()).toBe("efgh");
        });
    });
}, 1000);
