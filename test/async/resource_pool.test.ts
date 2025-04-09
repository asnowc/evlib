import { describe, expect } from "vitest";
import { MockConn, test } from "./__mock.ts";
import { ResourcePool } from "evlib/async";

test("count", async function ({ pool }) {
  const conn = await pool.get();
  expect(pool.totalCount).toBe(1);
  expect(pool.idleCount).toBe(0);

  const conn2 = await pool.get();
  expect(pool.totalCount).toBe(2);
  expect(pool.idleCount).toBe(0);

  pool.release(conn);
  expect(pool.totalCount).toBe(2);
  expect(pool.idleCount).toBe(1);

  pool.release(conn2);
  expect(pool.totalCount).toBe(2);
  expect(pool.idleCount).toBe(2);
  await pool.close();
});
test("最大连接数量 默认为 3", async function ({ resourceManage }) {
  const pool = new ResourcePool(resourceManage);
  const connList = await Promise.all([pool.get(), pool.get(), pool.get()]);
  expect(pool.waitingCount).toBe(0);
  expect(pool.totalCount).toBe(3);

  const next = pool.get();

  expect(pool.waitingCount).toBe(1);

  pool.release(connList[1]);

  await expect(next).resolves.toBe(connList[1]);

  expect(pool.waitingCount).toBe(0);
  expect(pool.totalCount).toBe(3);

  pool.release(connList[0]);
  pool.release(connList[1]);
  pool.release(connList[2]);
  await pool.close();
});
test("close() 后尝试再连接应抛出异常", async function ({ pool }) {
  const conn = pool.get().catch(() => {});
  const closePromise = pool.close();
  expect(pool.closed).toBe(true);
  await expect(pool.get()).rejects.toThrowError();

  await expect(closePromise).resolves.toBeUndefined();
});
test("在所有连接释放后，close() 返回的 Promise 才会被解决", async function ({ resourceManage }) {
  const pool = new ResourcePool(resourceManage, { maxCount: 2 });
  const conn1 = await pool.get();
  const conn2 = await pool.get();
  const conn3 = pool.get(); // 排队等待

  let flag = 0;
  const closePromise = pool.close().then(() => {
    flag = 1;
  });

  await expect(conn3, "等待中的连接会被拒绝").rejects.toThrowError();

  const conn = await Promise.all([conn1, conn2]);

  expect(flag, "promise 没有被解决").toBe(0);

  pool.release(conn[0]);
  expect(conn[0].connected, "disconnect() 立即被调用").toBeFalsy();

  pool.release(conn[1]);
  expect(conn[0].connected, "disconnect() 立即被调用").toBeFalsy();

  await expect(closePromise).resolves.toBeUndefined();
});
test("close(true) 会立即断开所有连接", async function ({ resourceManage }) {
  const pool = new ResourcePool(resourceManage, { maxCount: 2 });
  const conn1 = pool.get();
  const conn2 = pool.get();
  const conn3 = pool.get();

  const closePromise = pool.close(true);
  expect(pool.totalCount).toBe(0);
  expect(pool.idleCount).toBe(0);
  expect(pool.waitingCount).toBe(0);

  const connects: MockConn[] = await resourceManage.getAllCreatedConn();
  expect(connects.map((conn) => conn.connected), "所有连接的 disconnect() 方法已被调用").toEqual(
    new Array(connects.length).fill(false),
  );
  await expect(conn1).rejects.toThrowError();
  await expect(conn2).rejects.toThrowError();
  await expect(conn3).rejects.toThrowError();

  await closePromise;
});
test("串行获取50次连接", async function ({ resourceManage, pool }) {
  for (let i = 0; i < 50; i++) {
    const conn = await pool.get();
    pool.release(conn);
  }
  expect(pool.totalCount).toBe(1);
  expect(pool.waitingCount).toBe(0);
  expect(pool.idleCount).toBe(1);
  expect(resourceManage.create).toBeCalledTimes(1);
});
test("并行获取50次连接", async function ({ resourceManage, pool }) {
  const promises: Promise<MockConn>[] = [];
  for (let i = 0; i < 50; i++) {
    promises.push(pool.get());
  }

  for (const item of promises) {
    const conn = await item;
    pool.release(conn);
  }
  expect(pool.totalCount).toBe(ResourcePool.defaultMaxCount);
  expect(pool.waitingCount).toBe(0);
  expect(pool.idleCount).toBe(ResourcePool.defaultMaxCount);

  expect(resourceManage.create).toBeCalledTimes(ResourcePool.defaultMaxCount);
});

describe("连接中途断开", function () {
  test("空闲时断开", async function ({ pool, resourceManage }) {
    const conn = await pool.get();
    pool.release(conn);
    pool.remove(conn);
    expect(resourceManage.dispose).not.toBeCalled();
    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
  });
  test("使用中断开", async function ({ pool, resourceManage }) {
    const conn = await pool.get();
    pool.remove(conn);
    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
    expect(resourceManage.dispose).not.toBeCalled();
  });
});

describe("空闲连接超时", function () {
  test("空闲连接在超时后被移除", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { idleTimeout: 100 });
    const conn = await pool.get();
    pool.release(conn);

    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
    expect(resourceManage.dispose).toBeCalledTimes(1);
  });

  test("多个空闲连接在超时后被移除", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { idleTimeout: 100 });
    const conn1 = await pool.get();
    const conn2 = await pool.get();
    pool.release(conn1);
    pool.release(conn2);

    expect(pool.totalCount).toBe(2);
    expect(pool.idleCount).toBe(2);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
    expect(resourceManage.dispose).toBeCalledTimes(2);
  });

  test("空闲连接超时后再次获取新连接", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { idleTimeout: 100 });
    const conn = await pool.get();
    pool.release(conn);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const newConn = await pool.get();
    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(0);
    expect(resourceManage.create).toBeCalledTimes(2);
  });

  test("空闲连接未超时前不会被移除", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { idleTimeout: 200 });
    const conn = await pool.get();
    pool.release(conn);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
    expect(resourceManage.dispose).not.toBeCalled();
  });
});

describe("使用次数上限", function () {
  test("连接使用次数超过上限后被移除", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { usageLimit: 3 });

    for (let i = 0; i < 3; i++) {
      const conn = await pool.get();
      pool.release(conn);
    }

    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
    expect(resourceManage.dispose).toBeCalledTimes(1);
  });

  test("连接使用次数未超过上限不会被移除", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { usageLimit: 4 });

    for (let i = 0; i < 3; i++) {
      const conn = await pool.get();
      pool.release(conn);
    }

    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
    expect(resourceManage.dispose).not.toBeCalled();
  });
});
