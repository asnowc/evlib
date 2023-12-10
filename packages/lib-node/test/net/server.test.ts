import { Server, connectSocket } from "@eavid/lib-node/net";
import { expect, test, vi } from "vitest";

const listenPort = 8812;
const voidFn = () => {};
test("disposeQueue", async function () {
  const onError = vi.fn();
  let count = 0;
  const server = await new Promise<Server>(async (resolve, reject) => {
    const server = new Server(
      (conn) => {
        if (count++ === 0) conn.on("error", onError); //第二个不监听, 确保在关闭服务器时全局不会抛出异常
        else resolve(server); //确保第二个连接上
      },
      { type: "TCP" }
    );
    server.disposeQueue = true;
    try {
      await server.listen({ port: listenPort });

      const [s1, s2] = await Promise.all([connectSocket({ port: listenPort }), connectSocket({ port: listenPort })]);
      s1.on("error", voidFn);
      s2.on("error", voidFn);
    } catch (error) {
      reject(error);
    }
  });

  expect(server.keepCount).toBe(2);
  await server.close();
  expect(onError).toBeCalledTimes(1);
});
