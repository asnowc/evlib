import * as net from "node:net";
import { Pipe } from "./ipc.js";
import { Connection } from "./tcp.js";

/** @public */
export interface ServerOptions {
    /** @remarks 可选择覆盖所有 net.Socket' readableHighWaterMark 和 writableHighWaterMark。 默认值： 参见 stream.getDefaultHighWaterMark()。*/
    // highWaterMark?: number;
    /** @remarks 指示是否应在传入连接上暂停套接字。 默认值： false。*/
    // pauseOnConnect?: boolean;
    /** @remarks 如果设置为 true，则它会在收到新的传入连接后立即禁用 Nagle 算法。*/
    // noDelay?: boolean;

    /** @remarks 如果设置为 true，则它会在收到新的传入连接后立即执行连接的 unref()。*/
    unRef?: boolean;
    /** @remarks 如果设置为 true，则它会在接收到新的传入连接后立即在套接字上启用保持活动功能，类似于在 socket.setKeepAlive([enable][, initialDelay]) 中所做的。*/
    keepAlive?: boolean;
    /**
     * @remarks 如果设置为正数，它会设置在空闲套接字上发送第一个 keepalive 探测之前的初始延迟。
     * @defaultValue 0
     */
    keepAliveInitialDelay?: number;
}
/** @public */
export class Server<T extends Connection> {
    #server: net.Server;

    #connectionUnref?: boolean;
    constructor(options?: ServerOptions) {
        this.#connectionUnref = Boolean(options?.unRef);
        this.#server = new net.Server(options);
        this.#server.on("connection", (socket) => {
            if (this.#connectionUnref) socket.unref();
            if (!this.onConnection) {
                socket.destroy();
                return;
            }
            this.onConnection?.(new Connection(socket) as any);
        });
        this.#server.on("close", () => this.onClose?.());
        this.#server.on("error", (err?: Error) => this.onError?.());
    }
    onConnection?: (socket: T) => void;
    onClose?: () => void;
    onError?: (err?: Error) => void;

    listen(options: T): Promise<void> {
        return new Promise((resolve, reject) => {
            this.#server.listen(options, resolve);
        });
    }
    ref() {
        this.#server.ref();
    }
    unref() {
        this.#server.unref();
    }
    close() {
        return new Promise<void>((resolve, reject) => {
            const onClose = (err?: Error) => (err ? reject(err) : resolve());
            this.#server.close(onClose);
        });
    }

    get listening() {
        return this.#server.listening;
    }
    get [Symbol.asyncDispose]() {
        return this.#server[Symbol.asyncDispose];
    }
}

export class ServerCount<T extends Connection> extends Server<T> {
    #connections = new Set<net.Socket>();
    get connectedCount() {
        return this.#connections.size;
    }
    dispose() {
        const res = this.close();
        for (const socket of this.#connections) {
            socket.destroy();
        }
        this.#connections.clear();
        return res;
    }
}

interface ListenOptions {
    exclusive?: boolean;
    backlog?: number;
}

export interface TcpServerOptions extends ListenOptions {
    port: number;
    host?: string;
    ipv6Only?: boolean;
}

export interface IPCServerOptions extends ListenOptions {
    path: string;
    readableAll?: boolean;
    writableAll?: boolean;
}
