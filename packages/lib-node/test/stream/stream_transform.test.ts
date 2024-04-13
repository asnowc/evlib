import { afterTime } from "evlib";
import {
  readableToReadableStream,
  writableToWritableStream,
} from "../../src/stream/stream_transform.js";
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
        if ((encoding as any) !== "buffer")
          throw new Error("encoding must a buffer");
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
    expect(Buffer.concat(writeQueue).toString(), "写入的内容一致").toBe(
      writeContent.toString(),
    );

    /** 关闭流，等待 writable 的 final 的回调*/
    const pms = writer.close();
    expect(writeable.writableEnded).toBeTruthy();
    await pms;
    expect(writeable.writable).toBeFalsy();
    expect(writeable.writableFinished).toBeTruthy();
  });
  test("highWaterMark", async function () {
    const writeable = new Writable({
      write(chunk, encoding, callback) {},
      highWaterMark: 4,
    });
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
        await afterTime();
        const writer = writableToWritableStream(writeable).getWriter();
        await expect(writer.closed).rejects.toThrowError();
      });
      test("closed", async function () {
        const writeable = createWriteable();
        writeable.destroy();
        const writer = writableToWritableStream(writeable).getWriter();
        await expect(writer.closed).rejects.toThrowError();
      });
    });
  });
});

describe.concurrent(
  "readable",
  function () {
    test("read chunk", async function () {
      let total = 3;
      const readable = new Readable({
        read(size) {
          if (total > 0) this.push(Buffer.from([total--]));
          else this.push(null);
        },
        construct(callback) {
          setTimeout(callback, 10);
        },
      });

      const ctrl = readableToReadableStream(readable);
      const reader = ctrl.getReader();
      const chunks = await readAll(reader);

      expect(chunks.length).toBe(3);
      expect(Buffer.concat(chunks)).toEqual(Buffer.from([3, 2, 1]));
      await afterTime();
      expect(readable.readable).toBeFalsy();
      expect(readable.readableEnded).toBeTruthy();
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

      const ctrl = readableToReadableStream<Buffer>(readable);
      const reader = ctrl.getReader();
      let list: Buffer[] = [];

      do {
        const chunk = await reader.read();
        if (chunk.done) break;
        list.push(chunk.value);
      } while (true);
      const buf = Buffer.concat(list);
      expect(buf.toString()).toBe("abcd".repeat(3));
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
      expect(readable.push(data)).toBeTruthy(); //2
      await afterTime();
      expect(readable.push(data)).toBeTruthy(); //4
      await afterTime();
      expect(readable.push(data)).toBeFalsy(); //6
      await afterTime();
      await reader.read();
      await reader.read();
      expect(readable.push(data)).toBeTruthy();
      await afterTime();
      expect(readable.push(data)).toBeFalsy();
    });
    test("cancel(Error)", async function () {
      const { readable, reader, stream } = createReadableStream();
      const err = new Error("abort()");
      await reader.cancel(err);
      expect(readable.destroyed).toBeTruthy();
      expect(readable.readable).toBeFalsy();
    });
    test("cancel(false)", async function () {
      const { readable, reader, stream } = createReadableStream();
      await reader.cancel(false);
      expect(readable.destroyed).toBeTruthy();
      expect(readable.readable).toBeFalsy();
    });
    test("设置了readable 事件", async function () {
      const readable = new Readable({ read(size) {} });
      readable.on("readable", () => {});
      readable.push(Buffer.from("abcd"));
      readable.push(null);

      const ctrl = readableToReadableStream(readable);
      const reader = ctrl.getReader();

      await expect(reader.read()).resolves.toEqual({
        done: false,
        value: Buffer.from("abcd"),
      });
    });
    test("readable 直接结束", async function () {
      const { readable, stream, reader } = createReadableStream();
      setTimeout(() => readable.push(null));
      await reader.closed;
      await expect(reader.read()).resolves.toMatchObject({ done: true });
      expect(readable.readable).toBeFalsy();
    });
    test("不阻止readable的end 和close 事件", async function () {
      const { readable, stream, reader } = createReadableStream();
      readable.push("ab");
      setTimeout(() => {
        readable.push(null);
      });
      const endEvent = new Promise((resolve) => readable.on("end", resolve));
      const closeEvent = new Promise((resolve) =>
        readable.on("close", resolve),
      );
      await Promise.all([endEvent, closeEvent]);
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
          await expect(stream.closed).rejects.toThrowError(
            "raw stream is unreadable",
          );
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
  },
  1000,
);

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

async function readAll<T>(ctrl: ReadableStreamDefaultReader<T>): Promise<T[]> {
  const list: T[] = [];
  do {
    const chunk = await ctrl.read();
    if (chunk.done) return list;
    else list.push(chunk.value);
  } while (true);
}
