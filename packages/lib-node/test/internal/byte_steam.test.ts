import { DuplexStream } from "../../src/internal/byte_duplex.js";
import { Duplex } from "node:stream";
import { describe, expect, vi, test } from "vitest";
import { afterTime } from "evlib";

describe.concurrent("byteDuplex", function () {
  test("读取完成>写入完成", async function () {
    const { destroy, duplex, dpStream } = createDuplexStream();

    duplex.push(null); // end事件

    expect(dpStream.closed).toBeFalsy();
    await dpStream.closeWrite(); //finished事件
    await dpStream.watchClose();
    expect(dpStream.closed).toBeTruthy();
    expect(destroy, "Duplex 销毁周期已被执行").toBeCalled();
  });
  test("写入完成>读取完成", async function () {
    const { destroy, duplex, dpStream } = createDuplexStream();

    await dpStream.closeWrite();
    expect(dpStream.closed).toBeFalsy();
    // duplex.push(null);

    setTimeout(() => duplex.push(null));
    await expect(dpStream.read(1)).rejects.toThrowError();

    await dpStream.watchClose();
    expect(dpStream.closed).toBeTruthy();
    expect(destroy, "Duplex 销毁周期已被执行").toBeCalled();
  });
  test("dispose", async function () {
    const { destroy, dpStream } = createDuplexStream();

    const err = new Error();
    dpStream.dispose(err);

    const res = await dpStream.watchClose().catch((err) => err);
    expect(dpStream.closed, "duplexStream closed").toBeTruthy();
    expect(
      dpStream.writableClosed,
      "duplexStream.writable closed"
    ).toBeTruthy();
    expect(
      dpStream.readableClosed,
      "duplexStream.readable closed"
    ).toBeTruthy();
    expect(res).toBe(err);

    expect(destroy).toBeCalled();
  });

  /** 创建一个初始化的 DuplexStream, */
  function createDuplexStream() {
    const { destroy, duplex, write } = createDuplex();
    const dpStream = new DuplexStream(duplex);
    return { destroy, duplex, write, dpStream };
  }
});

function createDuplex() {
  const destroy = vi.fn((err, cb) => afterTime().then(cb));
  const write = vi.fn((chunk, encoding, cb) => afterTime().then(cb));

  const duplex = new Duplex({ destroy, write, read(size) {} });
  return { duplex, destroy, write };
}
