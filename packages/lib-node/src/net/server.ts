import * as net from "node:net";
import { EventTrigger, OnceEventTrigger } from "evlib";
import { Connection, SocketStream } from "./connection.ts";

interface ServerOpts {
  /** 可选择覆盖所有 net.Socket' readableHighWaterMark 和 writableHighWaterMark。 默认值： 参见 stream.getDefaultHighWaterMark()。*/
  highWaterMark?: number;
  /** 如果设置为 true，则它会在收到新的传入连接后立即禁用 Nagle 算法。*/
  noDelay?: boolean;

  /** 如果设置为 true，则它会在接收到新的传入连接后立即在套接字上启用保持活动功能，类似于在 socket.setKeepAlive([enable][, initialDelay]) 中所做的。*/
  keepAlive?: boolean;
  /**
   * 如果设置为正数，它会设置在空闲套接字上发送第一个 keepalive 探测之前的初始延迟。
   * @defaultValue 0
   */
  keepAliveInitialDelay?: number;

  //listen:

  /** 如果 exclusive 是 false（默认值），那么集群工作者将使用相同的底层句柄，允许共享连接处理职责。
   * @remarks
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

  /** 使管道对所有用户都可读 */
  readableAll?: boolean;
  /** 使管道对所有用户都可写 */
  writableAll?: boolean;
  type: "IPC";
  path?: string;
}
/** @public */
export interface ServerListenOpts {
  port?: number;
  host?: string;
  path?: string;
}
/** @public */
export type CreateTcpServerOpts = Omit<TcpServerOpts, "port">;
/** @public */
export type CreateIpcServerOpts = Omit<IpcServerOpts, "path">;

/** @public */
export class Server {
  /** @alpha */
  static listen(
    onConn: (conn: Connection) => void,
    options?: TcpServerOpts
  ): Promise<Server>;
  static listen(
    onConn: (conn: SocketStream) => void,
    options?: IpcServerOpts
  ): Promise<Server>;
  static async listen(
    onConn: (conn: any) => void,
    options: TcpServerOpts | IpcServerOpts = {}
  ) {
    const type = options.type;
    const onSocketConnect =
      type === "IPC"
        ? (socket: net.Socket) => onConn(new SocketStream(socket))
        : (socket: net.Socket) => onConn(new Connection(socket));
    const server = new this(onSocketConnect, options);
    await server.listen();
    return server;
  }

  constructor(
    onConn: (conn: net.Socket) => void,
    options?: TcpServerOpts | undefined
  );
  constructor(
    onConn: (conn: net.Socket) => void,
    options?: IpcServerOpts | undefined
  );
  constructor(
    onConn: (conn: net.Socket) => void,
    options?: TcpServerOpts | IpcServerOpts | undefined
  );
  constructor(
    onConn: (conn: net.Socket) => void,
    options: TcpServerOpts | IpcServerOpts = {}
  ) {
    if (typeof onConn !== "function")
      throw new Error("onConnection must be a function");
    const serverOpts: net.ServerOpts = {
      keepAlive: options.keepAlive,
      keepAliveInitialDelay: options.keepAliveInitialDelay,
      highWaterMark: options.highWaterMark,
      noDelay: options.noDelay,
      allowHalfOpen: true,
    } as net.ServerOpts;

    const server = new net.Server(serverOpts);
    this.#server = server;
    server.on("close", () => this.closeEvent.emit());
    server.on("error", (err: Error) => this.errorEvent.emit(err));

    {
      let listenOpts: net.ListenOptions;
      if (options.type === "IPC") {
        listenOpts = {
          readableAll: options.readableAll,
          writableAll: options.writableAll,
          path: options.path,
        };
        this.type = "IPC";
      } else {
        listenOpts = {
          host: options.host,
          ipv6Only: options.ipv6Only,
          port: options.port,
        };
        this.type = "TCP";
      }
      Object.assign(listenOpts, {
        exclusive: options.exclusive,
        backlog: options.backlog,
      });

      this.#options = listenOpts;
    }

    server.on("connection", (socket) => {
      if (this.disposeQueue) {
        socket.once("close", () => this.#connections.delete(socket));
        this.#connections.add(socket);
      }
      onConn(socket);
    });
  }
  readonly type: "IPC" | "TCP";
  #options: net.ListenOptions;
  #server = new net.Server();
  watchClose(signal?: AbortSignal) {
    return this.closeEvent.getPromise(signal);
  }
  readonly closeEvent = new OnceEventTrigger<void>();
  readonly errorEvent = new EventTrigger<Error>();
  /* c8 ignore next 3 */
  ref() {
    this.#server.ref();
  }
  /* c8 ignore next 3 */
  unref() {
    this.#server.unref();
  }
  /** 默认情况下, 关闭服务器时, 需要等待所有连接关闭, 才能彻底关闭服务器. 如果 disposeQueue 设置为 true, 当有新链接时, 将连接保存, 在执行 close 时会将所有保持的连接销毁 */
  disposeQueue: boolean = false;
  #connections = new Set<net.Socket>();
  /**
   * disposeQueue 中保持连接的数量
   */
  get keepCount() {
    return this.#connections.size;
  }
  listen(options: ServerListenOpts = {}) {
    return new Promise<void>((resolve, reject) => {
      const defaultOpts = this.#options;
      const {
        host = defaultOpts.host,
        port = defaultOpts.port,
        path = defaultOpts.path,
      } = options;
      if (this.type === "TCP") {
        if (typeof port !== "number")
          throw new Error("TCP Server 必须指定 port");
        this.#server.listen({ ...this.#options, host, port }, resolve);
      } else {
        if (typeof path !== "string")
          throw new Error("IPC Server 必须指定 path");
        this.#server.listen({ ...this.#options, path }, resolve);
      }
    });
  }
  close() {
    return new Promise<void>((resolve, reject) => {
      const onClose = (err?: Error) => (err ? reject(err) : resolve());
      this.#server.close(onClose);
      const err = new Error("The server is shut down manually");
      const voidFn = () => {};
      for (const conn of this.#connections) {
        conn.on("error", voidFn); //防止 EventEmitter 全局异常
        conn.destroy(err);
      }
      this.#connections.clear();
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
  /** 将调用close */
  [Symbol.asyncDispose]() {
    return this.close();
  }
}
