import { Server, connect, connectPipe } from "@eavid/lib-node/net";
import { expect, describe, vi, test, Mock } from "vitest";
import * as net from "node:net";
import { Duplex } from "node:stream";
// const { Socket } = (await vi.importActual("node:net")) as typeof net;

interface MockSocket extends Duplex {
    connect: Mock;
    destroy: Mock;
}

vi.mock("node:net", async function () {
    const mod = (await vi.importActual("node:net")) as typeof net;
    return { ...mod, Socket: vi.fn() };
});

describe("connect", function () {
    describe("signal", function () {
        test("signal中断", async function () {
            const socket: MockSocket = new MockSocket();
            (net.Socket as any as Mock).mockImplementationOnce(() => socket);

            const abc = new AbortController();
            const p = connect({ port: 80 }, { signal: abc.signal });
            expect(socket.connect).toHaveBeenCalledOnce();
            const err = new Error("abort");
            abc.abort(err);
            abc.abort(err);

            await expect(p, "promise 被拒绝, 并将中断的异常抛出").rejects.toBe(err);
            expect(socket.destroy).toBeCalledTimes(1);
            expect(socket.destroy, "socket 被销毁").toHaveBeenLastCalledWith(err);
        });
        test("成功后取消signal的监听", async function () {
            const socket: MockSocket = new MockSocket();
            socket.connect.mockImplementationOnce((opt, callback) => callback()); //连接成功
            (net.Socket as any as Mock).mockImplementationOnce(() => socket);

            const abc = new AbortController();
            const p = connect({ port: 80 });
            await p;
            abc.abort();
            expect(socket.destroy, "socket 没有调用销毁").not.toBeCalled();
        });
        test("已中断的signal", async function () {
            const socket: MockSocket = new MockSocket();
            (net.Socket as any as Mock).mockImplementationOnce(() => socket);

            const abc = new AbortController();
            abc.abort();
            const p = connect({ port: 80 }, { signal: abc.signal });

            await expect(p, "promise 被拒绝, 并将中断的异常抛出").rejects.toThrow();
            expect(socket.connect, "socket 没有调用连接").not.toBeCalled();
            expect(socket.destroy, "socket 没有调用销毁").not.toBeCalled();
        });
    });
});
class MockSocket extends Duplex {
    _read(size: number): void {} // node 16 必须实现 _read() _write()
    _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
        callback();
    }
    connect = vi.fn();
    destroy = vi.fn();
}
