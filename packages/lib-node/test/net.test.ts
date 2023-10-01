import { Server, connect, connectPipe } from "@eavid/lib-node/net";
import { expect, describe, vi, test } from "vitest";

describe("tcp", function () {
    test("listen/close", async function () {
        const port = 8889;
        const server = await Server.listen(port);
        server.disposeQueue = true;
        server.onConnection = (conn) => {};

        expect(server.listening).toBeTruthy();

        try {
            const conn = await connect({ port });
            await server.close();
            expect(server.listening).toBeFalsy();
            await conn.$closed;
            expect(conn.closed).toBeTruthy();
        } finally {
            if (server.listening) await server.close();
        }
    });
});
describe("ipc", function () {
    const PIPE_NAME = "mypipe";
    const PIPE_PATH = "\\\\.\\pipe\\" + PIPE_NAME;

    test("ipc server", async function () {
        const ipcServer = await Server.listen(PIPE_PATH);
        ipcServer.onConnection = async (pipe) => {
            await pipe.writable.close();
            pipe.dispose();
        };
        const socketStream = await connectPipe(PIPE_PATH);
    });
});
function afterTime(time?: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
