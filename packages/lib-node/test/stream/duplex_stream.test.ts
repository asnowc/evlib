import { Duplex } from "node:stream";
import { DuplexStream } from "../../src/stream/duplex_stream.js";

import { test, expect, describe, vi } from "vitest";

describe.skip.concurrent("duplex", function () {
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

function createDuplex() {
    const destroy = vi.fn((err, cb) => waitTime().then(cb));
    const write = vi.fn((chunk, encoding, cb) => waitTime().then(cb));

    const duplex = new Duplex({ destroy, write, read(size) {} });
    return { duplex, destroy, write };
}

function waitTime(time?: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
