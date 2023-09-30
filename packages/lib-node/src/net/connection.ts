import * as net from "node:net";
import { Listenable } from "#evlib";
import { DuplexStream } from "../stream/duplex_core.js";

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

    /** @remarks 接收到的字节数。 */
    get bytesRead() {
        return this.socket.bytesRead;
    }
    /** @remarks 发送的字节数 */
    get bytesWritten() {
        return this.socket.bytesWritten;
    }
}

/** @public */
export type TcpFamily = "IPv4" | "IPv6";

/** @public */
export class Connection extends SocketStream {
    constructor(socket: net.Socket) {
        super(socket);
        this.localFamily = socket.localFamily! as TcpFamily;
        this.localAddress = socket.localAddress!;
        this.localPort = socket.localPort!;
        this.remoteFamily = socket.remoteFamily! as TcpFamily;
        this.remoteAddress = socket.remoteAddress!;
        this.remotePort = socket.remotePort!;

        socket.on("timeout", () => this.$timeout.emit());
    }

    /**
     * @remarks 通过发送 RST 数据包关闭 TCP 连接并销毁流。
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
    /**
     * @remarks 启用/禁用 Nagle 算法的使用。
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
     * @remark timeout 事件
     */
    $timeout = new Listenable<void>();
}

/** @public */
export interface TcpConnectOpts {
    port: number;
    /** @defaultValue - localhost */
    host?: string;
    /** @remarks  IP 栈的版本。值 0 表示允许使用 IPv4 和 IPv6 地址 */
    family?: 4 | 6 | 0;
    /** @remarks 套接字应该使用的本地地址。 */
    localAddress?: string;
    /** @remarks 套接字应使用的本地端口。 */
    localPort?: number;
}

/**
 * @public
 * @remarks 创建TCP连接
 */
export function connect(options: TcpConnectOpts) {
    return new Promise<Connection>((resolve, reject) => {
        const socket = new net.Socket();
        socket.connect(options, function () {
            socket.off("error", reject);
            resolve(new Connection(socket));
        });
        socket.once("error", reject);
    });
}

/**
 * @alpha
 */
interface PipeOptions {
    /** 允许在套接字上读取，否则将被忽略。 默认值： false */
    readable?: boolean;
    /** 允许在套接字上读取，否则将被忽略。 默认值： false */
    writable?: boolean;
}
/**
 * @alpha
 * @param fd - 用给定的文件描述符封装现有的管道，否则将创建新的管道
 * @param path - 管道路径
 */
// export function connectPipe(fd: number, options?: PipeOptions): Promise<SocketStream>;
export function connectPipe(path: string): Promise<SocketStream>;
export function connectPipe(path: string | number, options: PipeOptions = {}) {
    return new Promise<SocketStream>((resolve, reject) => {
        if (typeof path === "number") {
            const socket = new net.Socket({ fd: path, readable: options.readable, writable: options.writable });
            resolve(new SocketStream(socket));
            return;
        }
        const socket = new net.Socket();
        socket.connect(path, function () {
            socket.off("error", reject);
            resolve(new SocketStream(socket));
        });
        socket.once("error", reject);
    });
}
