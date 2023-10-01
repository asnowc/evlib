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
}

/** @public */
export interface IpcServerOpts extends ServerOpts {
    /** 允许在套接字上读取，否则将被忽略。 默认值： false */
    readable?: boolean;
    /** 允许在套接字上读取，否则将被忽略。 默认值： false */
    writable?: boolean;

    //listen:

    /** @remarks 使管道对所有用户都可读 */
    readableAll?: boolean;
    /** @remarks 使管道对所有用户都可写 */
    writableAll?: boolean;
}

type ConnectionHandler<T> = (stream: T) => void;

/** @public */
export class Server<T extends SocketStream> {
    /**
     *
     */
    static listen(port: number, tcpOpts?: TcpServerOpts): Promise<Server<Connection>>;
    static listen(path: string, ipcOpts?: IpcServerOpts): Promise<Server<SocketStream>>;
    static async listen(port_path: number | string, options: TcpServerOpts | IpcServerOpts = {}): Promise<Server<any>> {
        const server = new this(port_path, options);
        await server.listen();
        return server;
    }
    constructor(port: number, options?: TcpServerOpts);
    constructor(path: string, options?: IpcServerOpts);
    constructor(port_path: string | number, options?: TcpServerOpts | IpcServerOpts);
    constructor(port_path: number | string, options: TcpServerOpts | IpcServerOpts = {}) {
        const rawOptions: net.ListenOptions = { ...options };
        if (typeof port_path === "string") {
            rawOptions.path = port_path;
            this.#TransformConn = SocketStream;
        } else {
            rawOptions.port = port_path;
            this.#TransformConn = Connection;
        }

        this.#options = rawOptions;
        const server = new net.Server();
        this.#server = server;
        server.on("close", () => this.$close.emit());
        server.on("error", (err: Error) => this.$error.emit(err));
    }
    #options;
    #server = new net.Server();
    #TransformConn;
    #rawOnConnection = (socket: net.Socket) => {
        const conn = new this.#TransformConn(socket) as T;
        if (this.disposeQueue) {
            socket.on("close", () => {
                this.#connections.delete(conn);
            });
            this.#connections.add(conn);
        }
        this.#onConnection!(conn);
    };
    #onConnection: ConnectionHandler<T> | null = null;
    get onConnection() {
        return this.#onConnection;
    }
    set onConnection(handler: ConnectionHandler<T> | null) {
        if (handler === null) {
            this.#server.off("connection", this.#rawOnConnection);
            this.#onConnection = null;
        } else if (typeof handler !== "function") throw new Error("handler must be a function or null");
        this.#onConnection = handler;
        this.#server.on("connection", this.#rawOnConnection);
    }
    $close = new Listenable<void>();
    $error = new Listenable<Error>();

    ref() {
        this.#server.ref();
    }
    unref() {
        this.#server.unref();
    }
    disposeQueue: boolean = false;
    #connections = new Set<SocketStream>();

    listen() {
        return new Promise<void>((resolve, reject) => {
            this.#server.listen(this.#options, resolve);
        });
    }
    close() {
        return new Promise<void>((resolve, reject) => {
            const onClose = (err?: Error) => (err ? reject(err) : resolve());
            this.#server.close(onClose);

            const err = new Error("server closed");
            for (const conn of this.#connections) {
                conn.dispose(err);
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
    /** @remark 将调用close */
    get [Symbol.asyncDispose]() {
        return this.#server[Symbol.asyncDispose];
    }
}
