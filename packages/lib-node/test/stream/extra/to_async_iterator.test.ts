import { readableToAsyncIterator } from "@eavid/lib-node/stream";
import { describe, test, expect, vi } from "vitest";

import { Duplex, Readable } from "node:stream";
import { afterTime } from "evlib";

describe("readableToAsyncIterator", function () {
  function createMockRead() {
    const readable = new Readable({ read(size) {} });
    const iter = readableToAsyncIterator(readable);
    return { readable, iter };
  }
  test("for await of", async function () {
    const { iter, readable } = createMockRead();
    const list: Uint8Array[] = [];
    setTimeout(() => {
      readable.push(Buffer.from("ab"));
      readable.push(Buffer.from("cd"));
      readable.push(null);
    });
    for await (const chunk of iter) {
      list.push(chunk);
    }
    expect(list.length).toBe(2);
    expect(Buffer.concat(list).toString()).toBe("abcd");
  });
  test("传入 duplex", async function () {
    const stream = new Duplex({
      read(size) {},
      write(chunk, encoding, callback) {},
    });
    const iter = readableToAsyncIterator(stream);
    const list: Uint8Array[] = [];
    setTimeout(() => {
      stream.push(Buffer.from("ab"));
      stream.push(Buffer.from("cd"));
      stream.push(null);
    });
    for await (const chunk of iter) {
      list.push(chunk);
    }
    expect(list.length).toBe(2);
    expect(Buffer.concat(list).toString()).toBe("abcd");
  });
  test(".destroy(undefined)", async function () {
    const { iter, readable } = createMockRead();
    setTimeout(() => {
      readable.destroy();
    });
    await expect(iter.next()).rejects.toThrowError();
  });
  test(".destroy(error)", async function () {
    const { iter, readable } = createMockRead();
    const err = new Error(".destroy");
    setTimeout(() => readable.destroy(err));
    await expect(iter.next()).rejects.toBe(err);
  });
  test("创建 reader 前流已经结束", async function () {
    const { iter, readable } = createMockRead();
    readable.on("data", () => {});
    readable.push(null);
    await afterTime();
    await expect(iter.next()).resolves.toMatchObject({ done: true });
  });

  test("break|return", async function () {
    const { iter, readable } = createMockRead();
    setTimeout(() => {
      readable.push("abc");
    });
    const [a, b] = await Promise.allSettled([iter.next(), iter.return()]);
    expect(a.status === "fulfilled").toBeTruthy();

    /** 已经移除事件 */
    expect(readable.listenerCount("readable")).toBe(0);
    expect(readable.listenerCount("close")).toBe(0);
    expect(readable.listenerCount("end")).toBe(0);
    expect(readable.listenerCount("data")).toBe(0);

    expect(readable.isPaused(), "流处于暂停状态").toBeTruthy();
    expect(readable.destroyed).toBeFalsy();
  });
  test("throw()", async function () {
    const { iter, readable } = createMockRead();
    setTimeout(() => {
      readable.push("abc");
    });
    const error = new Error("异常");
    const [a, b] = await Promise.allSettled([iter.next(), iter.throw(error)]);
    expect(a.status === "fulfilled").toBeTruthy();

    /** 已经移除事件 */
    expect(readable.listenerCount("readable")).toBe(0);
    expect(readable.listenerCount("close")).toBe(0);
    expect(readable.listenerCount("end")).toBe(0);
    expect(readable.listenerCount("data")).toBe(0);
    expect(readable.destroyed).toBeTruthy();
  });
}, 1000);
