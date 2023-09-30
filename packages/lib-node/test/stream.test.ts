import { readableToReadableStream, writableToWritableStream } from "../src/stream/stream.js";
import { DuplexStream } from "../src/stream/duplex_core.js";
import { Writable, Readable, Duplex } from "node:stream";
import { ReadableStreamDefaultReader } from "node:stream/web";
import { test, expect, describe, vi } from "vitest";

type WritableOption = NonNullable<ConstructorParameters<typeof Writable>[0]>;

describe.concurrent("writeable", function () {
    test("write chunk", async function () {
        const writeContent = Buffer.from("abcdef"); //length =4
        let writeQueue: any[] = [];

        const option: WritableOption = {
            write(chunk, encoding, callback) {
                if ((encoding as any) !== "buffer") throw new Error("encoding must a buffer");
                writeQueue.push(chunk);
                setTimeout(callback, 50);
            },
            construct(callback) {
                setTimeout(callback, 200);
            },
        };
        const writeable = new Writable(option);
        const writerCtrl = writableToWritableStream(writeable);
        const writer = writerCtrl.getWriter();

        {
            const p1 = writer.write(writeContent.subarray(0, 2));
            const p2 = writer.write(writeContent.subarray(2, 4));
            const p3 = writer.write(writeContent.subarray(4));
            await Promise.all([p1, p2, p3]);
        }

        expect(writeQueue.length, "写入了3个chunk").toBe(3);
        expect(Buffer.concat(writeQueue).toString(), "写入的内容一致").toBe(writeContent.toString());

        /** 关闭流，等待 writable 的 final 的回调*/
        const pms = writer.close();
        expect(writeable.writableEnded).toBeTruthy();
        await pms;
        expect(writeable.writable).toBeFalsy();
        expect(writeable.writableFinished).toBeTruthy();
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

        const err = new Error("abort()");
        await stream.abort(err);

        expect(writeable.destroyed).toBeTruthy();
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
                await expect(writer.closed).rejects.toThrowError("raw stream closed");
            });
            test("closed", async function () {
                const writeable = createWriteable();
                writeable.destroy();
                const writer = writableToWritableStream(writeable).getWriter();
                await expect(writer.closed).rejects.toThrowError("raw stream closed");
            });
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

        const ctrl = readableToReadableStream(readable);
        const reader = ctrl.getReader();
        const chunks = await readAll(reader);

        expect(chunks.length).toBe(3);
        expect(Buffer.concat(chunks)).toEqual(Buffer.from([3, 2, 1]));
        await waitTime();
        expect(readable.readable).toBeFalsy();
        expect(readable.readableEnded).toBeTruthy();
    });
    test("销毁 ReadableStream: cancel()", async function () {
        const onDestroy = vi.fn();
        const readable = new Readable({ read() {}, destroy: onDestroy });

        const ctrl = readableToReadableStream(readable);
        const reason = new Error();
        await ctrl.cancel(reason);

        expect(onDestroy.mock.calls[0][0]).toBe(reason);
        expect(readable.destroyed).toBeTruthy();
    });
    test("highWaterMark", async function () {
        const readable = new Readable({ read() {}, highWaterMark: 6 });

        const ctrl = readableToReadableStream(readable);
        const reader = ctrl.getReader();
        const data = Buffer.from("ab");
        expect(readable.push(data)).toBeTruthy();
        await waitTime();
        expect(readable.push(data)).toBeTruthy();
        await waitTime();
        expect(readable.push(data)).toBeFalsy();
        await waitTime();
        await reader.read();
        await reader.read();
        expect(readable.push(data)).toBeTruthy();
        await waitTime();
        expect(readable.push(data)).toBeFalsy();
    });
    test("cancel()", async function () {
        const { readable, reader, stream } = createReadableStream();
        const err = new Error("abort()");
        await reader.cancel(err);
        expect(readable.destroyed).toBeTruthy();
        expect(readable.readable).toBeFalsy();
    });
    test("readable 直接结束", async function () {
        const { readable, stream, reader } = createReadableStream();
        readable.push(null);
        await reader.closed;
        expect(readable.readable).toBeFalsy();
    }, 100);
    describe("readable 异常", function () {
        test("被销毁", async function () {
            const readable = createReadable();
            const writerCtrl = readableToReadableStream(readable);
            const err = new Error("abc");
            readable.destroy(err);
            const reader = writerCtrl.getReader();
            await expect(reader.closed).rejects.toBe(err);
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

    function createReadableStream() {
        const readable = new Readable({
            read(size) {},
        });
        const stream = readableToReadableStream(readable);
        const reader = stream.getReader();
        return { readable, stream, reader };
    }
});

describe.concurrent("duplex", function () {
    test("读取完成>写入完成", async function () {
        const { destroy, duplex, writer, reader, stream } = createDuplexStream();

        duplex.push(null);
        await reader.closed;
        expect(duplex.writable).toBeTruthy();
        expect(stream.closed).toBeFalsy();
        writer.close();
        await writer.closed;
        expect(stream.closed).toBeTruthy();
        expect(destroy, "Duplex 销毁周期已被执行").toBeCalled();
    });
    test("写入完成>读取完成", async function () {
        const { destroy, duplex, writer, reader, stream } = createDuplexStream();

        writer.close();
        await writer.closed;
        expect(duplex.readable).toBeTruthy();
        expect(stream.closed).toBeFalsy();
        duplex.push(null);
        await reader.closed;
        expect(stream.closed).toBeTruthy();
        expect(destroy, "Duplex 销毁周期已被执行").toBeCalled();
    });
    test("dispose", async function () {
        const { destroy, duplex, writer, reader, stream } = createDuplexStream();
        const err = new Error();
        stream.dispose(err);
        expect(stream.closed).toBeTruthy();
        expect(destroy).toBeCalled();
        expect(duplex.destroyed).toBeTruthy();

        await expect(writer.closed, "writer 应异常关闭").rejects.toBe(err);
        await expect(reader.closed, "reader 应异常关闭").rejects.toBe(err);
    });
    describe("duplex 异常", function () {
        test("被销毁", async function () {
            const { duplex } = createDuplex();
            const stream = new DuplexStream(duplex);
            const err = new Error("abc");
            duplex.destroy(err);
            const reader = stream.readable.getReader();
            const writer = stream.writable.getWriter();
            await expect(writer.closed, "writer 应异常关闭").rejects.toBe(err);
            await expect(reader.closed, "reader 应异常关闭").rejects.toBe(err);
        });
    });

    /** 创建一个初始化的 DuplexStream, */
    function createDuplexStream() {
        const { destroy, duplex, write } = createDuplex();
        const stream = new DuplexStream(duplex);
        const reader = stream.readable.getReader();
        const writer = stream.writable.getWriter();
        return { destroy, duplex, write, stream, reader, writer };
    }
});

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
function createDuplex() {
    const destroy = vi.fn((err, cb) => waitTime().then(cb));
    const write = vi.fn((chunk, encoding, cb) => waitTime().then(cb));

    const duplex = new Duplex({ destroy, write, read(size) {} });
    return { duplex, destroy, write };
}
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
