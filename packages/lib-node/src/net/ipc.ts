import { SocketStream } from "./socket_stream.js";

export class Pipe extends SocketStream {}

interface SocketConstructorOpts {
    /** 如果指定，则使用给定的文件描述符封装现有的套接字，否则将创建新的套接字。 */
    fd: number;
    /** 允许在套接字上读取，否则将被忽略。 默认值： false */
    readable?: boolean;
    /** 允许在套接字上读取，否则将被忽略。 默认值： false */
    writable?: boolean;
}
interface IpcConnectOpts {
    path: string;
}
