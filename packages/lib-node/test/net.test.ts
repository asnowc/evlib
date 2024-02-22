import { Server, SocketStream, connect, connectPipe } from "@eavid/lib-node/net";
import { expect, describe, vi, test } from "vitest";
import { platform } from "node:os";

describe("tcp", function () {
    test("listen/close", async function () {
        const port = 8889;
        const server = new Server(
            (conn) => {
                conn.on("error", () => {});
            },
            { port }
        );
        await server.listen();
        server.disposeQueue = true;

        expect(server.listening).toBeTruthy();

        try {
            const conn = await connect({ port });
            await conn.closeWrite();
            await server.close();
            expect(server.listening).toBeFalsy();
            await conn.$closed;
            expect(conn.closed).toBeTruthy();
        } finally {
            if (server.listening) await server.close();
        }
    });
});
describe.runIf(platform() === "win32")("ipc", function () {
    const PIPE_NAME = "mypipe";
    const PIPE_PATH = "\\\\.\\pipe\\" + PIPE_NAME;

    test("ipc server", async function () {
        async function onConnection(pipe: SocketStream) {
            await pipe.dispose();
        }
        const ipcServer = await Server.listen(onConnection, { path: PIPE_PATH, type: "IPC" });
        const socketStream = await connectPipe({ path: PIPE_PATH });
    });
});
function afterTime(time?: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
