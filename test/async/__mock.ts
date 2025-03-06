import { ResourceManager, ResourcePool } from "evlib/async";
import { expect, test as viTest, vi } from "vitest";
export class MockConn {
  idle = false;
  connected = true;
}
export class MockResourceManage implements ResourceManager<MockConn> {
  create = vi.fn<() => Promise<MockConn>>(async function () {
    return new MockConn();
  });
  dispose = vi.fn<(conn: MockConn) => void>(function (conn) {
    if (conn.connected === false) throw new Error("connected 已经是 false");
    conn.connected = false;
  });
  markIdle = vi.fn<(conn: MockConn) => void>(function (conn) {
    if (conn.idle === true) throw new Error("idle 已经是 true");
    conn.idle = true;
  });
  markUsed = vi.fn<(conn: MockConn) => void>(function (conn) {
    if (conn.idle === false) throw new Error("idle 已经是 false");
    conn.idle = false;
  });

  getAllCreatedConn(): Promise<MockConn[]> {
    return Promise.all(this.create.mock.results.map((item) => item.value));
  }
}
export interface Context {
  resourceManage: MockResourceManage;
  pool: ResourcePool<MockConn>;
}
export const test = viTest.extend<Context>({
  async resourceManage({}, use) {
    const manage = new MockResourceManage();
    await use(new MockResourceManage());
    const connList = await manage.getAllCreatedConn();
    await expect(connList.map((item) => item.connected), "所有连接已断开").toEqual(connList.map(() => false));
  },
  async pool({ resourceManage }, use) {
    use(new ResourcePool(resourceManage));
  },
});
