import { createByteReaderFromReadable, createByteReaderFromWebStream } from "@eavid/lib-node/stream";
import { describe, test, expect, vi } from "vitest";
import {
    ReadableStream,
    UnderlyingSource,
    ReadableStreamDefaultController,
    ByteLengthQueuingStrategy,
} from "node:stream/web";
import { Readable } from "node:stream";
import { afterTime } from "evlib";
describe("createReaderFromWebStream", function () {
    describe("取消reader", function () {
        test("cancel()", function () {
            const { cancel, read, stream, ctrl } = createMockRead();
            ctrl.enqueue(Buffer.allocUnsafe(4));
            ctrl.close();
            cancel();
            expect(cancel()).toBe(null);
        });
        test("缓存有剩余", async function () {
            const { read, cancel, ctrl } = createMockRead();
            ctrl.enqueue(Buffer.allocUnsafe(4));
            ctrl.close();
            await read(2);

            const val = cancel() as Buffer;
            expect(val!.byteLength).toBe(2);
        });
        test("缓存无剩余", async function () {
            const { cancel, read, ctrl } = createMockRead();
            ctrl.enqueue(Buffer.allocUnsafe(4));
            await read(4);
            expect(cancel()).toBe(null);
        });
    });
    function createMockRead() {
        const source = new MockSource();
        const stream = new ReadableStream<Uint8Array>(source, new ByteLengthQueuingStrategy({ highWaterMark: 0 }));
        const { read, cancel } = createByteReaderFromWebStream(stream);
        return {
            stream,
            ctrl: source.ctrl,
            read,
            cancel,
        };
    }
    class MockSource implements UnderlyingSource {
        ctrl!: ReadableStreamDefaultController;
        start(ctrl: ReadableStreamDefaultController) {
            this.ctrl = ctrl;
        }
    }
});
describe("createByteReaderFromReadable", function () {
    function createMockRead() {
        const readable = new Readable({ read(size) {} });
        const { read, cancel } = createByteReaderFromReadable(readable);
        return { readable, read, cancel };
    }

    describe("等待分段", function () {
        test("一个chunk足够多个分段", async function () {
            const { read, readable } = createMockRead();
            readable.push(Buffer.from("abcdefghij"));
            readable.push(null);
            await expect(read(Buffer.alloc(4)).then((buf) => buf.toString())).resolves.toBe("abcd");
            await expect(read(Buffer.alloc(2)).then((buf) => buf.toString())).resolves.toBe("ef");
            await expect(read(Buffer.alloc(2)).then((buf) => buf.toString())).resolves.toBe("gh");
            await expect(read(Buffer.alloc(2)).then((buf) => buf.toString())).resolves.toBe("ij");
            await expect(read(Buffer.alloc(2), true)).resolves.toBe(null);
        });
        test("需要等待多个chunk", async function () {
            const { read, readable } = createMockRead();
            let pms = read(Buffer.alloc(4));
            {
                //mock
                readable.push(Buffer.from("ab"));
                await new Promise<void>((resolve) => setTimeout(resolve));
                readable.push(Buffer.from("cd"));
                readable.push(null);
            }
            await expect(pms.then((buf) => buf.toString())).resolves.toBe("abcd");
            await expect(read(2, true)).resolves.toBe(null);
        });
        test("等待的chunk足够下一个分段", async function () {
            const { read, readable } = createMockRead();
            const p1 = expect(read(Buffer.alloc(4)).then((buf) => buf.toString())).resolves.toBe("abcd");
            readable.push(Buffer.from("ab"));
            await afterTime();
            readable.push(Buffer.from("cdefgh"));
            readable.push(null);
            await p1;
            await expect(read(Buffer.alloc(4)).then((buf) => buf.toString())).resolves.toBe("efgh");
        });
    });
    test("_read() 触发", async function () {
        let total = 12;
        const read = vi.fn((size) => {
            while (total > 0) {
                total -= 4;
                if (!readable.push("abcd")) return;
            }
            readable.push(null);
        });
        const readable = new Readable({
            read,
            highWaterMark: 8,
        });

        const { read: nextChunk } = createByteReaderFromReadable(readable);
        await afterTime();
        expect(read).toBeCalledTimes(1);
        expect(readable.readableLength, "_read调用后添加源").toBe(8);
        let list: Uint8Array[] = [];
        list.push((await nextChunk())!); // chunk length =4
        expect(read).toBeCalledTimes(2);
        do {
            const chunk = await nextChunk();
            if (chunk) list.push(chunk);
            else break;
        } while (true);
        const buf = Buffer.concat(list);
        expect(buf.toString()).toBe("abcd".repeat(3));
    });
    test("队列读取", async function () {
        const { read, readable } = createMockRead();
        const pms = Promise.all([read(2), read(2), read(2)]);
        const buf = Buffer.from([0, 1, 0, 2, 0, 3]);
        readable.push(buf);
        readable.push(null);
        const arr = (await pms).map((buf) => Buffer.from(buf).readUint16BE());
        expect(arr).toEqual(arr);
    });
    test("不安全读取", async function () {
        const { read, readable } = createMockRead();
        let pms = read(4);
        readable.push(Buffer.allocUnsafe(2));
        readable.push(null);
        await expect(pms).rejects.toThrowError();
    });

    test("安全读取", async function () {
        const { read, readable } = createMockRead();
        let pms = read(4, true);
        readable.push(Buffer.allocUnsafe(2));
        readable.push(null);
        await expect(pms).resolves.toBe(null);
    });
    describe("异常", function () {
        test("结束的流继续读取", async function () {
            const { read, readable } = createMockRead();
            readable.push(null);
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
            await afterTime();
            const { read } = createByteReaderFromReadable(readable);
            /** 未监听 */
            expect(readable.listenerCount("readable")).toBe(0);
            expect(readable.listenerCount("close")).toBe(0);
            expect(readable.listenerCount("end")).toBe(0);
            await expect(read(2, true)).resolves.toBe(null);
        });
        test("没有autoDestroy 的流", async function () {
            const readable = new Readable({ read(size) {}, autoDestroy: false });
            readable.on("readable", () => {});
            const { cancel, read } = createByteReaderFromReadable(readable);
            readable.push("ab", "utf-8");
            setTimeout(() => readable.push(null));
            await expect(read(4)).rejects.toThrow();
        });
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