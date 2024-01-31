import { createByteReadable, createByteWritable, WritableHandle } from "@eavid/lib-node/stream";
import { DuplexStream } from "../../src/internal/byte_duplex.js";
import { Duplex } from "node:stream";
import { describe, expect, vi, test } from "vitest";
import { ReadableStream, ReadableStreamController } from "node:stream/web";

describe("byteReadable", function () {
  /**
   * @param chunks 向可读流的队列添加初始数据
   * @param close 结束数据
   */
  function createMockRead<T extends Uint8Array>(chunks: T[] = [], close?: boolean) {
    const stream = new MockReadableStream<T>(chunks);
    if (close) stream.close();
    const reader = createByteReadable<T>(stream);
    return { reader, stream };
  }

  describe("迭代", function () {
    const rawList = [Buffer.from("abcd"), Buffer.from("cdef"), Buffer.from("ghijk")];
    test("迭代", async function () {
      const { stream, reader } = createMockRead<Buffer>(rawList, true);
      const onClose = vi.fn();
      reader.$readableClosed.on(onClose);
      const list: Buffer[] = [];
      for await (const chunk of reader) {
        list.push(chunk);
      }
      expect(onClose).toBeCalledTimes(1);
      expect(reader.readableClosed).toBeTruthy();
      expect(list).toEqual(rawList);
    });
    test("迭代时读取", async function () {
      const { stream, reader } = createMockRead<Buffer>(rawList, true);
      await reader.read(2);
      const itr = reader[Symbol.asyncIterator]();
      const pms = await Promise.all([itr.next(), reader.read(), itr.next(), itr.next(), itr.next()]);
      const done = pms[4];
      expect(pms[0].value.toString()).toBe("cd");
      expect(pms[1]).toBeNull();
      expect(pms[2].value.toString()).toBe("cdef");
      expect(pms[3].value.toString()).toBe("ghijk");
      expect(done.done).toBeTruthy();
    });
  });
  describe("出现异常执行操作", function () {
    /** 两种情况, 正常cancel() 和异常 cancel() */
    describe.each([
      { arg: undefined, desc: "正常 cancel" },
      { arg: new Error("cancel"), desc: "使用异常 cancel" },
    ])("$desc", function ({ arg: err }) {
      const reader = createMockRead().reader;
      reader.cancel(err);
      test("cancel 后读取", async function () {
        if (err instanceof Error) {
          await expect(reader.read()).rejects.toBe(err);
          await expect(reader.read(3)).rejects.toBe(err);
        } else {
          await expect(reader.read()).resolves.toBe(null);
          await expect(reader.read(3, true)).resolves.toBe(null);
        }
      });
      test("cancel 后迭代", async function () {
        const itr = reader[Symbol.asyncIterator]();
        if (err instanceof Error) {
          await expect(itr.next()).rejects.toBe(err);
        } else {
          await expect(itr.next()).resolves.toMatchObject({ done: true });
        }
      });
      test("读取中 cancel", async function () {
        const { stream, reader } = createMockRead<Buffer>([]);
        setTimeout(() => {
          reader.cancel(err);
        });
        if (err instanceof Error) {
          await expect(reader.read()).rejects.toBe(err);
          await expect(reader.read(3)).rejects.toBe(err);
        } else {
          await expect(reader.read()).resolves.toBe(null);
          await expect(reader.read(3, true)).resolves.toBe(null);
        }
      });
      test("迭代中 cancel", async function () {
        const { reader } = createMockRead<Buffer>([]);

        const itr = reader[Symbol.asyncIterator]();
        setTimeout(() => {
          reader.cancel(err);
        });
        if (err instanceof Error) {
          await expect(itr.next()).rejects.toBe(err);
        } else {
          await expect(itr.next()).resolves.toMatchObject({ done: true });
        }
      });
    });
  });
  describe("pipeTo", function () {
    const rawList = [Buffer.from("abcd"), Buffer.from("cdef"), Buffer.from("ghijk")];
    test.each([true, false])("pipeTo-preventClose: %s", async function (preventClose) {
      const { reader } = createMockRead<Buffer>(rawList, true);

      const writeList: Buffer[] = [];
      const pipeTarget: WritableHandle<Buffer> = {
        write: vi.fn(async function (chunk) {
          writeList.push(chunk);
        }),
        close: vi.fn(),
      };
      await reader.pipeTo(pipeTarget, { preventClose });

      expect(writeList).toEqual(rawList);
      expect(reader.readableClosed).toBeTruthy();
      if (preventClose) {
        expect(pipeTarget.close).not.toBeCalled();
      } else {
        expect(pipeTarget.close).toBeCalledTimes(1);
      }
    });

    describe("管道异常", async function () {
      test("传输异常到目标(abort())", async function () {
        const { reader } = createMockRead<Buffer>();
        const err = new Error();
        await reader.cancel(err);

        const pipeTarget: WritableHandle<Buffer> = {
          write() {},
          close: vi.fn(),
          abort: vi.fn(),
        };
        await expect(reader.pipeTo(pipeTarget)).rejects.toBe(err);
        expect(pipeTarget.close).not.toBeCalled();
        expect(pipeTarget.abort).toBeCalledWith(err);
      });
      test("传输异常到源(cancel())", async function () {
        const { reader, stream } = createMockRead<Buffer>([Buffer.from("ab")]);
        const onErr = vi.fn();
        reader.$readableClosed.then(onErr);
        const err = new Error();
        const pipeTarget: WritableHandle<Buffer> = {
          write() {
            return Promise.reject(err);
          },
          close: vi.fn(),
        };

        await expect(reader.pipeTo(pipeTarget), "管道 reject").rejects.toBe(err);
        expect(pipeTarget.close, "目标应调用关闭方法").not.toBeCalled();
        expect(reader.readableClosed, "源应关闭").toBeTruthy();
        expect(onErr).toBeCalledWith(err, false);
      });
      test("阻止传输异常到目标(abort())", async function () {
        const { reader } = createMockRead<Buffer>();
        const err = new Error();
        await reader.cancel(err);

        const pipeTarget: WritableHandle<Buffer> = {
          write() {},
          close: vi.fn(),
          abort: vi.fn(),
        };
        await expect(reader.pipeTo(pipeTarget, { preventAbort: true })).rejects.toBe(err);
        expect(pipeTarget.close).not.toBeCalled();
        expect(pipeTarget.abort).not.toBeCalled();
      });
      test("阻止异常到源(cancel())", async function () {
        const { reader } = createMockRead<Buffer>([Buffer.from("ab")]);
        const onErr = vi.fn();
        reader.$readableClosed.then(onErr);
        const err = new Error();
        const pipeTarget: WritableHandle<Buffer> = {
          write() {
            throw err;
          },
          close: vi.fn(),
        };
        await expect(reader.pipeTo(pipeTarget, { preventCancel: true })).rejects.toBe(err);
        expect(reader.readableClosed).toBeFalsy();
        expect(onErr).not.toBeCalled();
      });
      test("中断传输", async function () {
        const { reader } = createMockRead<Buffer>(rawList);
        const pipeTarget: WritableHandle<Buffer> = {
          write() {},
          close: vi.fn(),
        };
        const abc = new AbortController();
        const err = new Error("abc");
        setTimeout(() => {
          abc.abort(err);
        });
        await expect(reader.pipeTo(pipeTarget, { preventClose: true, signal: abc.signal })).rejects.toThrow(err);
        expect(pipeTarget.close).not.toBeCalled();
      });
    });
  });
  describe("read", function () {
    describe("指定长度", function () {
      test("chunk分解", async function () {
        const { stream, reader } = createMockRead<Buffer>([Buffer.from("abcdefghij")]);
        stream.close();
        await expect(reader.read(4).then((buf) => Buffer.from(buf).toString())).resolves.toBe("abcd");
        await expect(reader.read(2).then((buf) => Buffer.from(buf).toString())).resolves.toBe("ef");
        await expect(reader.read(2).then((buf) => Buffer.from(buf).toString())).resolves.toBe("gh");
        await expect(reader.read(2).then((buf) => Buffer.from(buf).toString())).resolves.toBe("ij");
        await expect(reader.read(2, true)).resolves.toBe(null);
      });
      test("chunk合成", async function () {
        const { stream, reader } = createMockRead([Buffer.from("ab"), Buffer.from("cd")]);
        stream.close();
        await reader.read(4);
        await expect(reader.read(2, true)).resolves.toBe(null);
      });
      test("读取到视图", async function () {
        const { stream, reader } = createMockRead<Buffer>([Buffer.from("abcdefghij")], true);
        const view = new DataView(new ArrayBuffer(6));
        await expect(reader.read(view), "应返回视图").resolves.toBe(view);
        expect(Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString(), "视图被正确写入").toBe("abcdef");
        await expect(reader.read(view, true), "安全读取:长度不足").resolves.toBeNull();
        await expect(reader.read(view), "不安全读取:长度不足").rejects.toThrowError();
      });

      test("队列读取", async function () {
        const { reader, stream } = createMockRead<Buffer>();
        const pms = Promise.all([reader.read(2), reader.read(2)]);
        const buf = Buffer.from([0, 1, 0, 2]);
        stream.push(buf);
        stream.close();
        const arr = (await pms).map((buf) => Buffer.from(buf!).readUint16BE());
        expect(arr).toEqual(arr);

        await expect(reader.read()).resolves.toBeNull();
      });
      test("不安全读取:没有更多数据", async function () {
        const { reader, stream } = createMockRead();
        let pms = reader.read(4);
        stream.push(Buffer.allocUnsafe(2));
        stream.close();
        await expect(pms).rejects.toThrowError();
      });

      test("安全读取:没有更多数据", async function () {
        const { reader, stream } = createMockRead();
        let pms = reader.read(4, true);
        stream.push(Buffer.allocUnsafe(2));
        stream.close();
        await expect(pms).resolves.toBe(null);
      });
      test("安全读取:源发生异常", async function () {
        const { reader, stream } = createMockRead();
        const err = new Error();
        setTimeout(() => {
          reader.cancel(err);
        });
        await expect(reader.read(4, true)).rejects.toBe(err);
      });
    });
  });
  describe("close事件", function () {
    test("触发", async function () {
      const { reader, stream } = createMockRead();

      setTimeout(() => stream.close());
      await reader.$readableClosed;
    });
    test("触发顺序", async function () {
      const { reader, stream } = createMockRead();
      const emitList: string[] = [];

      setTimeout(() => stream.close());
      reader.$readableClosed.then(() => emitList.push("$closed"));
      await Promise.all([reader.$readableClosed, reader.read().then(() => emitList.push("read"))]);
      expect(emitList).toEqual(["$closed", "read"]);
    });
  });

  describe("异常", function () {
    test("小于1的读取", async function () {
      const { reader, stream } = createMockRead();
      await expect(reader.read(0)).rejects.toThrowError();
    });
  });
}, 1000);

describe.concurrent("byteDuplex", function () {
  test("读取完成>写入完成", async function () {
    const { destroy, duplex, dpStream } = createDuplexStream();
    const { callList } = getEmitList(dpStream);

    duplex.push(null); // end事件
    await dpStream.$readableClosed;
    expect(dpStream.readableClosed).toBeTruthy();
    expect(dpStream.closed).toBeFalsy();
    await dpStream.close(); //finished事件
    await dpStream.$closed;
    expect(dpStream.closed).toBeTruthy();
    expect(destroy, "Duplex 销毁周期已被执行").toBeCalled();

    expect(callList, "事件顺序").toEqual(["readable", "writable", "duplex"]);
  });
  test("写入完成>读取完成", async function () {
    const { destroy, duplex, dpStream } = createDuplexStream();
    const { callList } = getEmitList(dpStream);

    await dpStream.close();
    expect(dpStream.closed).toBeFalsy();
    // duplex.push(null);

    setTimeout(() => duplex.push(null));
    await dpStream.$readableClosed;
    await expect(dpStream.read()).resolves.toBeNull();

    await dpStream.$closed;
    expect(dpStream.closed).toBeTruthy();
    expect(destroy, "Duplex 销毁周期已被执行").toBeCalled();

    expect(callList, "事件顺序").toEqual(["writable", "readable", "duplex"]);
  });
  test("dispose", async function () {
    const { destroy, duplex, dpStream } = createDuplexStream();

    const { argList, callList } = getEmitList(dpStream);

    const err = new Error();
    dpStream.dispose(err);

    const res = await dpStream.$closed;
    expect(dpStream.closed, "duplexStream closed").toBeTruthy();
    expect(dpStream.writableClosed, "duplexStream.writable closed").toBeTruthy();
    expect(dpStream.readableClosed, "duplexStream.readable closed").toBeTruthy();
    expect(res).toBe(err);

    expect(destroy).toBeCalled();
    expect(argList).toEqual([err, err, err]);
    expect(callList).toEqual(["writable", "readable", "duplex"]);
  });
  /** 监听事件触发 */
  function getEmitList(dpStream: DuplexStream) {
    const callList: any[] = [];
    const argList: any[] = [];
    dpStream.$writableClosed.on((err) => {
      callList.push("writable");
      argList.push(err);
    });
    dpStream.$readableClosed.on((err) => {
      callList.push("readable");
      argList.push(err);
    });
    dpStream.$closed.on((err) => {
      callList.push("duplex");
      argList.push(err);
    });
    return { callList, argList };
  }
  /** 创建一个初始化的 DuplexStream, */
  function createDuplexStream() {
    const { destroy, duplex, write } = createDuplex();
    const dpStream = new DuplexStream(duplex);
    return { destroy, duplex, write, dpStream };
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

class MockReadableStream<T = Uint8Array> extends ReadableStream<T> {
  constructor(intiChunks: T[] = []) {
    let ctrlTmp!: ReadableStreamController<T>;
    super({
      start: async (ctrl) => {
        ctrlTmp = ctrl;
        for (const chunk of intiChunks) {
          ctrl.enqueue(chunk);
        }
      },
    });
    this.ctrl = ctrlTmp;
  }
  ctrl?: ReadableStreamController<T>;
  push(chunk: T) {
    this.ctrl?.enqueue(chunk);
  }
  close() {
    this.ctrl?.close();
  }
  error(reason?: Error) {
    this.ctrl?.error(reason);
  }
}
