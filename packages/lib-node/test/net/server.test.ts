import { Server, connectSocket } from "@eavid/lib-node/net";
import { expect, test, vi } from "vitest";

const listenPort = 8812;
const voidFn = () => {};
test("disposeQueue", async function () {
  const onError = vi.fn();
  let count = 0;
  const server = new Server(
    (conn) => {
      if (count++ === 0) conn.on("error", onError); //第二个不监听, 确保在关闭服务器时全局不会抛出异常
    },
    { type: "TCP" }
  );
  server.disposeQueue = true;
  await server.listen({ port: listenPort });

  const [s1, s2] = await Promise.all([connectSocket({ port: listenPort }), connectSocket({ port: listenPort })]);
  s1.on("error", voidFn);
  s2.on("error", voidFn);

  expect(server.keepCount).toBe(2);
  await server.close();
  expect(onError).toBeCalledTimes(1);
});
