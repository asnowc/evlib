import * as net from "node:net";
import { EventTrigger } from "evlib";
import { DuplexStream } from "../internal/byte_duplex.ts";
/* c8 ignore start */
/**
 * @alpha
 */
export class SocketStream extends DuplexStream<Buffer> {
  constructor(protected socket: net.Socket) {
    super(socket);
  }
  ref() {
    this.socket.ref();
  }
  unref() {
    this.socket.unref();
  }

  /** 接收到的字节数。 */
  get bytesRead() {
    return this.socket.bytesRead;
  }
  /** 发送的字节数 */
  get bytesWritten() {
    return this.socket.bytesWritten;
  }
}
/* c8 ignore end */
/** @public */
export type TcpFamily = "IPv4" | "IPv6";

/** @alpha */
export class Connection extends SocketStream {
  constructor(socket: net.Socket) {
    super(socket);
    this.localFamily = socket.localFamily! as TcpFamily;
    this.localAddress = socket.localAddress!;
    this.localPort = socket.localPort!;
    this.remoteFamily = socket.remoteFamily! as TcpFamily;
    this.remoteAddress = socket.remoteAddress!;
    this.remotePort = socket.remotePort!;

    socket.on("timeout", () => this.timeoutEvent.emit());
  }

  /** 通过发送 RST 数据包关闭 TCP 连接并销毁流
   * @remarks
   * 如果这个 TCP 套接字处于连接状态，它会发送一个 RST 数据包，并在连接后销毁这个 TCP 套接字。
   * 否则，它将调用 socket.destroy 并返回 ERR_SOCKET_CLOSED 错误。
   * @throws ERR_SOCKET_CLOSED
   */
  resetAndDestroy() {
    this.socket.resetAndDestroy();
  }

  setKeepAlive(enable?: boolean, delay?: number) {
    this.socket.setKeepAlive(enable, delay);
  }
  /** 启用/禁用 Nagle 算法的使用
   * @remarks
   * 创建 TCP 连接时，它将启用 Nagle 算法。
   * Nagle 的算法会在数据通过网络发送之前延迟数据。 它试图以延迟为代价来优化吞吐量。
   */
  enableNagle(enable: boolean) {
    this.socket.setNoDelay(!enable);
  }

  readonly localFamily: TcpFamily;
  readonly localAddress: string;
  readonly localPort: number;
  readonly remoteFamily: TcpFamily;
  readonly remoteAddress: string;
  readonly remotePort: number;
  /**
   * @remarks
   * Sets the connection to timeout after `timeout` milliseconds of inactivity on
   * the connection. By default `net.Socket` do not have a timeout.
   *
   *  当空闲超时被触发时，套接字将收到一个“超时”事件，但连接不会被切断。用户必须手动调用' connection.dispose() 来结束连接
   *
   * ```js
   * connection.setTimeout(3000);
   * connection.$timeout.on(() => {
   *   console.log('connection timeout');
   *   connection.dispose();
   * });
   * ```
   *
   * If `timeout` is 0, then the existing idle timeout is disabled.
   *
   * The optional `callback` parameter will be added as a one-time listener for the `'timeout'` event.
   */
  get timeout() {
    return this.socket.timeout ?? 0;
  }
  set timeout(time: number) {
    this.socket.setTimeout(time);
  }
  /**
   * timeout 事件
   */
  readonly timeoutEvent = new EventTrigger<void>();
}

/** 创建 tcp 连接的选项
 * @public
 */
export interface TcpConnectConfig {
  port: number;
  /** @defaultValue - localhost */
  host?: string;
  /** IP 栈的版本。值 0 表示允许使用 IPv4 和 IPv6 地址 */
  family?: 4 | 6 | 0;
  /** 套接字应该使用的本地地址。 */
  localAddress?: string;
  /** 套接字应使用的本地端口。 */
  localPort?: number;
}
/** 连接的其他可选选项
 * @public
 */
export interface ConnectOptions {
  /** 中断连接的信号 */
  signal?: AbortSignal;
}

/** 创建TCP连接
 * @alpha
 */
export function connect(config: TcpConnectConfig, options?: ConnectOptions) {
  return connectSocket(config, options).then(
    (socket) => new Connection(socket)
  );
}
/** 创建一个已连接的 Socket
 * @public
 */
export function connectSocket(
  config: TcpConnectConfig | PipeConfig,
  options?: ConnectOptions
): Promise<net.Socket>;
export function connectSocket(config: any, options: ConnectOptions = {}) {
  return new Promise<net.Socket>((resolve, reject) => {
    const { signal } = options;
    const newOpts: net.SocketConstructorOpts =
      typeof config.path === "string"
        ? {
            fd: config.fd,
            readable: config.readable,
            writable: config.writable,
            allowHalfOpen: true,
          }
        : { allowHalfOpen: true };
    const socket = new net.Socket(newOpts);
    function clear() {
      socket.off("error", reject);
      signal?.removeEventListener("abort", onAbort);
    }
    function onAbort(this: AbortSignal, e: Event) {
      clear();
      socket.destroy(this.reason);
      reject(this.reason);
    }
    function onReject() {
      clear();
      reject();
    }
    if (signal) {
      signal.throwIfAborted();
      signal.addEventListener("abort", onAbort);
    }

    socket.connect(
      {
        port: config.port,
        path: config.path,
        family: config.family,
        host: config.host,
        localAddress: config.localAddress,
        localPort: config.localPort,
      },
      function () {
        clear();
        resolve(socket);
      }
    );
    socket.once("error", onReject);
  });
}
/**
 * @alpha
 */
export interface PipeConfig {
  /** 管道路径 */
  path: string;

  // new Socket 参数:

  /** 用给定的文件描述符封装现有的管道，否则将创建新的管道 */
  fd?: number;
  /** 允许在套接字上读取，否则将被忽略。 默认值： false */
  readable?: boolean;
  /** 允许在套接字上读取，否则将被忽略。 默认值： false */
  writable?: boolean;
}
/**
 * @alpha
 */
export function connectPipe(
  config: PipeConfig,
  options: ConnectOptions = {}
): Promise<SocketStream> {
  return connectSocket(config, options).then(
    (socket) => new SocketStream(socket)
  );
}
