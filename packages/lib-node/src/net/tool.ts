import { NetConnectOpts, Socket, createConnection } from "node:net";

export function createConnectedTcp(options: NetConnectOpts, abortSignal?: AbortSignal) {
    return new Promise<Socket>(function (resolve, reject) {
        const socket = createConnection(options);
        function onConnect() {
            clear();
            resolve(socket);
        }
        function onError(e?: any) {
            socket.destroy(e);
            clear();
            reject(e);
        }
        function clear() {
            socket.off("connect", onConnect);
            socket.off("onError", onError);
            socket.off("onClose", onError);
            abortSignal?.removeEventListener("abort", onError);
        }
        abortSignal?.addEventListener("abort", onError);
        socket.on("connect", onConnect);
        socket.on("close", onError);
    });
}
