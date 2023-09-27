import { readableToReadableStream, writableToWritableStream } from "../src/stream.js";
import { Writable, Readable } from "node:stream";
import { ReadableStreamDefaultReader } from "node:stream/web";
import { test, expect, describe, vi, afterAll, Mock } from "vitest";
const nodeVersion = parseInt(process.versions.node.slice(0, 2));
type WritableOption = NonNullable<ConstructorParameters<typeof Writable>[0]>;

function createWriteable() {
    return new Writable({
        write(chunk, encoding, callback) {
            callback();
        },
    });
}
function createReadable() {
    return new Readable({
        read(size) {},
    });
}
describe.concurrent("writeable", function () {
    test("write chunk", async function () {
        const writeContent = Buffer.from("abcdef"); //length =4
        let writeQueue: any[] = [];

        const option: WritableOption = {
            write(chunk, encoding, callback) {
                if ((encoding as any) !== "buffer") throw new Error();
                writeQueue.push(chunk);
                setTimeout(callback, 50);
            },
            final: vi.fn((callback) => {
                setTimeout(callback, 50);
            }),
            construct(callback) {
                setTimeout(callback, 200);
            },
        };
        const writeable = new Writable(option);
        const writerCtrl = writableToWritableStream(writeable);
        const writer = writerCtrl.getWriter();

        writer.write(writeContent.subarray(0, 2));
        writer.write(writeContent.subarray(2, 4));
        await writer.write(writeContent.subarray(4));

        expect(writeQueue.length, "写入了3个chunk").toBe(3);
        expect(Buffer.concat(writeQueue).toString(), "写入的内容一致").toBe(writeContent.toString());

        expect(option.final).not.toBeCalled();

        /** 关闭流，等待 writable 的 final 的回调*/
        await writer.close();
        expect(option.final).toBeCalled();

        if (nodeVersion > 18) {
            expect(writeable.closed).toBeTruthy();
            expect(writeable.errored).toBeFalsy();
        }
    });
    test("highWaterMark", async function () {
        const writeable = new Writable({ write(chunk, encoding, callback) {}, highWaterMark: 4 });
        const writeCtrl = writableToWritableStream(writeable);
        const writer = writeCtrl.getWriter();
        const data = Buffer.alloc(2);

        expect(writer.desiredSize).toBe(4);
        writer.write(data).catch(() => {}); //处理
        expect(writer.desiredSize).toBe(2);
        writer.write(data).catch(() => {}); //入队
        expect(writer.desiredSize).toBe(0);
        writer.write(data).catch(() => {}); //入队
        expect(writer.desiredSize).toBe(-2);
        await writer.abort();
    });
    test("abort()", async function () {
        const writeable = createWriteable();
        const stream = writableToWritableStream(writeable);
        const onClose = vi.fn();
        writeable.on("close", onClose);
        const err = new Error("abort()");
        await stream.abort(err);

        if (nodeVersion >= 18) {
            expect(writeable.errored).toBe(err);
            expect(writeable.closed).toBeTruthy();
        }
        await waitTime();
        expect(onClose).toBeCalled();
    });
    describe("writeable 异常", function () {
        test("被销毁", async function () {
            const writeable = createWriteable();
            const writerCtrl = writableToWritableStream(writeable);
            const err = new Error("abc");
            writeable.destroy(err);
            const writer = writerCtrl.getWriter();
            await expect(writer.closed).rejects.toBe(err);
        });
    });
    describe("错误状态的 writeable", function () {
        test("writeable errored", async function () {
            const writeable = createWriteable();
            writeable.on("error", () => {});
            const err = new Error("abc");
            writeable.destroy(err);

            const writer = writableToWritableStream(writeable).getWriter();
            await expect(writer.closed).rejects.toBe(err);
        });
        test("writable finished", async function () {
            const writeable = createWriteable();
            writeable.end();
            await waitTime();
            const writer = writableToWritableStream(writeable).getWriter();
            await expect(writer.closed).rejects.toThrowError("writable finished");
        });
        test("closed", async function () {
            const writeable = createWriteable();
            writeable.destroy();
            const writer = writableToWritableStream(writeable).getWriter();
            await expect(writer.closed).rejects.toThrowError("raw stream closed");
        });
    });
});

describe.concurrent("readable", function () {
    test("read chunk", async function () {
        let total = 3;
        const readable = new Readable({
            read(size) {
                if (total > 0) this.push(Buffer.from([total--]));
                else this.push(null);
            },
            construct(callback) {
                setTimeout(callback, 100);
            },
        });
        const onEnd = vi.fn();
        const onClose = vi.fn();
        readable.on("end", onEnd);
        readable.on("close", onClose);

        const ctrl = readableToReadableStream(readable);
        const reader = ctrl.getReader();
        const chunks = await readAll(reader);

        expect(chunks.length).toBe(3);
        expect(Buffer.concat(chunks)).toEqual(Buffer.from([3, 2, 1]));

        await waitTime();
        if (nodeVersion >= 18) {
            expect(readable.closed).toBeTruthy();
        }
        expect(readable.readableEnded).toBeTruthy();
        expect(onEnd).toBeCalled();
        expect(onClose).toBeCalled();
    });
    test("销毁 ReadableStream: cancel()", async function () {
        const onDestroy = vi.fn();
        const readable = new Readable({ read() {}, destroy: onDestroy });

        const ctrl = readableToReadableStream(readable);
        const reason = {};
        await ctrl.cancel(reason);

        expect(onDestroy.mock.calls[0][0]).toBe(reason);
        expect(readable.destroyed).toBeTruthy();
        if (nodeVersion >= 18) expect(readable.errored).toBeTruthy();
    });
    test("highWaterMark", async function () {
        const readable = new Readable({ read() {}, highWaterMark: 6 });

        const ctrl = readableToReadableStream(readable);
        const reader = ctrl.getReader();
        const data = Buffer.from("ab");
        expect(readable.push(data)).toBeTruthy();
        expect(readable.push(data)).toBeTruthy();
        expect(readable.push(data)).toBeFalsy();
        await reader.read();
        await reader.read();
        expect(readable.push(data)).toBeTruthy();
        expect(readable.push(data)).toBeFalsy();
    });
    test("cancel()", async function () {
        const readable = createReadable();
        const onClose = vi.fn();
        readable.on("close", onClose);
        const stream = readableToReadableStream(readable);
        const err = new Error("abort()");

        await stream.cancel(err);
        expect(readable.readableAborted).toBeTruthy();
        if (nodeVersion >= 18) {
            expect(readable.errored).toBe(err);
            expect(readable.closed).toBeTruthy();
        }
        await waitTime();
        expect(onClose).toBeCalled();
    });
    describe("readable 异常", function () {
        test("被销毁", async function () {
            const readable = createReadable();
            const writerCtrl = readableToReadableStream(readable);
            const err = new Error("abc");
            readable.destroy(err);
            const reader = writerCtrl.getReader();
            await expect(reader.closed).rejects.toBe(err);
        });
    });
    describe("错误状态的 readable", function () {
        test("readable errored", async function () {
            const readable = createReadable();
            readable.on("error", () => {});
            const err = new Error("abc");
            readable.destroy(err);

            const stream = readableToReadableStream(readable).getReader();
            await expect(stream.closed).rejects.toBe(err);
        });

        test("closed", async function () {
            const readable = createReadable();
            readable.destroy();
            const stream = readableToReadableStream(readable).getReader();
            await expect(stream.closed).rejects.toThrowError("raw stream closed");
        });
    });
});
async function readAll<T>(ctrl: ReadableStreamDefaultReader<T>): Promise<T[]> {
    const list: T[] = [];
    do {
        const chunk = await ctrl.read();
        if (chunk.done) return list;
        else list.push(chunk.value);
    } while (true);
}

function waitTime(time?: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
