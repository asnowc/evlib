import * as net from "node:net";
import { Listenable } from "#evlib";
import { Connection, SocketStream } from "./connection.js";

interface ServerOpts {
    /** @remarks 可选择覆盖所有 net.Socket' readableHighWaterMark 和 writableHighWaterMark。 默认值： 参见 stream.getDefaultHighWaterMark()。*/
    highWaterMark?: number;
    /** @remarks 如果设置为 true，则它会在收到新的传入连接后立即禁用 Nagle 算法。*/
    noDelay?: boolean;

    /** @remarks 如果设置为 true，则它会在接收到新的传入连接后立即在套接字上启用保持活动功能，类似于在 socket.setKeepAlive([enable][, initialDelay]) 中所做的。*/
    keepAlive?: boolean;
    /**
     * @remarks 如果设置为正数，它会设置在空闲套接字上发送第一个 keepalive 探测之前的初始延迟。
     * @defaultValue 0
     */
    keepAliveInitialDelay?: number;

    //listen:

    /**
     * @remarks 如果 exclusive 是 false（默认值），那么集群工作者将使用相同的底层句柄，允许共享连接处理职责。
     * 当 exclusive 为 true 时，句柄未共享，尝试端口共享会导致错误
     * 当 exclusive 为 true 且底层 handle 共享时，有可能多个 worker 查询一个 handle 具有不同的积压。 在这种情况下，将使用传递给主进程的第一个 backlog
     */
    exclusive?: boolean;
    backlog?: number;
}

/** @public */
export interface TcpServerOpts extends ServerOpts {
    //listen:

    host?: string;
    ipv6Only?: boolean;
    type?: "TCP";
    port?: number;
}

/** @public */
export interface IpcServerOpts extends ServerOpts {
    //listen:

    /** @remarks 使管道对所有用户都可读 */
    readableAll?: boolean;
    /** @remarks 使管道对所有用户都可写 */
    writableAll?: boolean;
    type: "IPC";
    path?: string;
}

type ConnectionHandler<T> = (stream: T) => void;

/** @public */
export class Server<T = Connection> {
    /**
     *
     */
    static listen(tcpOpts: TcpServerOpts): Promise<Server<Connection>>;
    static listen(ipcOpts: IpcServerOpts): Promise<Server<SocketStream>>;
    static async listen(options: TcpServerOpts | IpcServerOpts): Promise<Server<any>> {
        const server = new this(options);
        await server.listen();
        return server;
    }
    /**
     * @param toConn - 连接转换函数
     */
    constructor(options: TcpServerOpts);
    constructor(options: IpcServerOpts);
    constructor(options: TcpServerOpts | IpcServerOpts, toConn?: (socket: net.Socket) => T);
    constructor(options: TcpServerOpts | IpcServerOpts, toConn?: (socket: net.Socket) => T) {
        if (toConn !== undefined && typeof toConn !== "function") throw new Error("toConn must be a function");
        const serverOpts: net.ServerOpts = {
            keepAlive: options.keepAlive,
            keepAliveInitialDelay: options.keepAliveInitialDelay,
            highWaterMark: options.highWaterMark,
            noDelay: options.noDelay,
        } as any;

        const server = new net.Server(serverOpts);
        this.#server = server;
        server.on("close", () => this.$close.emit());
        server.on("error", (err: Error) => this.$error.emit(err));

        {
            let listenOpts: net.ListenOptions;
            if (options.type === "IPC") {
                listenOpts = {
                    readableAll: options.readableAll,
                    writableAll: options.writableAll,
                    path: options.path,
                };
                if (!toConn) toConn = (socket) => new SocketStream(socket) as T;
            } else {
                listenOpts = {
                    host: options.host,
                    ipv6Only: options.ipv6Only,
                    port: options.port,
                };

                if (!toConn) toConn = (socket) => new Connection(socket) as T;
            }
            Object.assign(listenOpts, {
                exclusive: options.exclusive,
                backlog: options.backlog,
            });

            this.#options = listenOpts;
        }

        server.on("connection", (socket) => {
            if (!this.onConnection) {
                socket.destroy();
                return;
            }
            if (this.disposeQueue) {
                socket.on("close", () => this.#connections.delete(socket));
                this.#connections.add(socket);
            }
            const conn = toConn!(socket);
            this.onConnection(conn);
        });
    }
    /**
     * @remarks 接收连接的函数, 如果不存在, 将会拒绝所有连接
     */
    onConnection?: ConnectionHandler<T>;
    #options: net.ListenOptions;
    #server = new net.Server();
    $close = new Listenable<void>();
    $error = new Listenable<Error>();
    /* c8 ignore next 3 */
    ref() {
        this.#server.ref();
    }
    /* c8 ignore next 3 */
    unref() {
        this.#server.unref();
    }
    /**
     * @remarks 默认情况下, 关闭服务器时, 需要等待所有连接关闭, 才能彻底关闭服务器. 如果 disposeQueue 设置为 true, 当有新链接时, 将连接保存, 在执行 close 时会将所有保持的连接销毁
     */
    disposeQueue: boolean = false;
    #connections = new Set<net.Socket>();
    /**
     * @remarks disposeQueue 中保持连接的数量
     */
    get keepCount() {
        return this.#connections.size;
    }
    listen(options?: Pick<TcpServerOpts, "port" | "host">) {
        return new Promise<void>((resolve, reject) => {
            const listenOpts = this.#options;
            if (!listenOpts.path && options) {
                if (options.host) listenOpts.host = options.host;
                if (options.port) listenOpts.port = options.port;
            }
            this.#server.listen(listenOpts, resolve);
        });
    }
    close() {
        return new Promise<void>((resolve, reject) => {
            const onClose = (err?: Error) => (err ? reject(err) : resolve());
            this.#server.close(onClose);
            const err = new Error("server closed");
            for (const conn of this.#connections) {
                conn.destroy(err);
            }
        });
    }
    /** @alpha */
    get fd(): number | Object {
        const hd = (this.#server as any)._handle;
        return hd.fd > 0 ? hd.fd : hd;
    }
    get listening() {
        return this.#server.listening;
    }
    /** @remarks 将调用close */
    [Symbol.asyncDispose]() {
        return this.close();
    }
}
