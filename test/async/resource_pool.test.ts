import { describe, expect, vi } from "vitest";
import { MockConn, test } from "./__mock.ts";
import { ResourceManager, ResourcePool } from "evlib/async";
import { updateSetTimeout } from "../../src/core/internal.ts";

vi.setConfig({
  testTimeout: 1000, // 该文件内每个测试最多 60 秒
});
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

describe("close", () => {
  test("close() 后尝试再连接应抛出异常", async function ({ pool }) {
    const conn = pool.get();
    const closePromise = pool.close();
    expect(pool.closed).toBe(true);
    await expect(pool.get()).rejects.toThrow();
    pool.release(await conn);
    await expect(closePromise).resolves.toBeUndefined();
  });
  test("close() 会等待排队中的请求被解决，且所有借用的连接释放后再 resolve", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { maxCount: 2 });
    const conn1 = await pool.get();
    const conn2 = await pool.get();
    const conn3Promise = pool.get(); // 排队等待

    let flag = 0;
    const closePromise = pool.close().then(() => {
      flag = 1;
    });
    pool.release(conn1);

    const conn3 = await conn3Promise;
    expect(flag, "promise 没有被解决").toBe(0);
    pool.release(conn3);
    pool.release(conn2);

    await expect(closePromise).resolves.toBeUndefined();
  });

  test("关闭期间创建连接失败不会使 close 悬挂", async () => {
    const created = Promise.withResolvers<object>();
    const pool = new ResourcePool({ create: () => created.promise, dispose() {} });
    const borrowing = pool.get();
    const closing = pool.close();
    created.reject(new Error("failed"));
    await expect(borrowing).rejects.toThrow("failed");
    await closing;
  });
});
describe("destroy", function () {
  test("destroy() 会立即断开所有连接", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { maxCount: 2 });
    const conn1 = await pool.get();
    const conn2 = await pool.get();

    pool.destroy();
    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
    expect(pool.waitingCount).toBe(0);

    const connects = await resourceManage.getAllCreatedConn();

    expect(connects.map((conn) => conn.connected), "所有连接的 disconnect() 方法已被调用").toEqual(
      new Array(connects.length).fill(false),
    );
  });
  test("destroy() 会立即断开所有连接", async function () {
    const manage = {
      create: vi.fn(() => Promise.resolve({})),
      dispose: vi.fn(),
    } satisfies ResourceManager<{}>;
    const pool = new ResourcePool(manage);
    const conn1 = pool.get();
    pool.destroy();
    const mockCreate = manage.create.mock;
    // expect((mockCreate.calls[0] as any[])[0]!.signal.aborted, "create 函数的 signal 已被终止").toEqual(true);
    const conn = await mockCreate.results[0].value;
    const mockDispose = manage.dispose.mock.calls[0];
    expect(mockDispose[0], "连接成功后 conn 实例被立即销毁").toBe(conn);
    await expect(conn1).rejects.toThrow("Pool is destroyed");
  });
});
test("串行获取50次连接", async function ({ resourceManage, pool }) {
  for (let i = 0; i < 50; i++) {
    const conn = await pool.get();
    pool.release(conn);
  }
  expect(pool.totalCount).toBe(1);
  expect(pool.waitingCount).toBe(0);
  expect(pool.idleCount).toBe(1);
  expect(resourceManage.create).toHaveBeenCalledTimes(1);
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

  expect(resourceManage.create).toHaveBeenCalledTimes(ResourcePool.defaultMaxCount);
});

describe("连接中途断开", function () {
  test("空闲时断开", async function ({ pool, resourceManage }) {
    const conn = await pool.get();
    pool.release(conn);
    pool.remove(conn);
    expect(resourceManage.dispose).not.toHaveBeenCalled();
    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
  });
  test("使用中断开", async function ({ pool, resourceManage }) {
    const conn = await pool.get();
    pool.remove(conn);
    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
    expect(resourceManage.dispose).not.toHaveBeenCalled();
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
    expect(resourceManage.dispose).toHaveBeenCalledTimes(1);
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
    expect(resourceManage.dispose).toHaveBeenCalledTimes(2);
  });

  test("空闲连接超时后再次获取新连接", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { idleTimeout: 100 });
    const conn = await pool.get();
    pool.release(conn);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const newConn = await pool.get();
    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(0);
    expect(resourceManage.create).toHaveBeenCalledTimes(2);
  });

  test("空闲连接未超时前不会被移除", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { idleTimeout: 200 });
    const conn = await pool.get();
    pool.release(conn);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
    expect(resourceManage.dispose).not.toHaveBeenCalled();
  });
  test("关闭连接池，应直接关闭计时器", async function ({ resourceManage }) {
    vi.useFakeTimers();
    updateSetTimeout(setTimeout, clearTimeout);

    const pool = new ResourcePool(resourceManage, { idleTimeout: 100 });
    const conn = await pool.get();
    pool.release(conn);

    expect(vi.getTimerCount()).toBe(1);
    await pool.close();
    expect(vi.getTimerCount(), "计算器已被清空").toBe(0);

    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
    expect(resourceManage.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("使用次数上限", function () {
  test("排队交接计入 usageLimit，淘汰后继续满足等待者", async ({ resourceManage }) => {
    const pool = new ResourcePool(resourceManage, { maxCount: 1, usageLimit: 2 });
    const conn1 = await pool.get();
    const second = pool.get();
    const third = pool.get();
    pool.release(conn1); // 转移到 second
    {
      const conn2 = await second;
      expect(conn2).toBe(conn1);
      expect(pool.idleCount).toBe(0);
      pool.release(conn2);
    }
    const conn3 = await third;
    expect(conn3, "新连接不应与旧连接相同").not.toBe(conn1);
    expect(resourceManage.dispose).toHaveBeenCalledWith(conn1);
    pool.release(conn3);
    await pool.close();
  });
  test("连接使用次数超过上限后被移除", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { usageLimit: 3 });

    for (let i = 0; i < 3; i++) {
      const conn = await pool.get();
      pool.release(conn);
    }

    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
    expect(resourceManage.dispose).toHaveBeenCalledTimes(1);
  });

  test("连接使用次数未超过上限不会被移除", async function ({ resourceManage }) {
    const pool = new ResourcePool(resourceManage, { usageLimit: 4 });

    for (let i = 0; i < 3; i++) {
      const conn = await pool.get();
      pool.release(conn);
    }

    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
    expect(resourceManage.dispose).not.toHaveBeenCalled();
  });
});

test("通过 remove 移除连接，解决 close 的 promise", async ({ resourceManage }) => {
  const pool = new ResourcePool(resourceManage, { maxCount: 1 });
  const first = await pool.get();
  const closing = pool.close();
  pool.remove(first);
  await closing;
  await expect(pool.totalCount).toBe(0);
});
