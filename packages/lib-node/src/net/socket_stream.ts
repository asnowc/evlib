import type { Socket } from "node:net";
import { DuplexStream } from "../internal/duplex_core.js";
import { Buffer } from "node:buffer";

export abstract class SocketStream extends DuplexStream<Buffer> {
    constructor(protected socket: Socket) {
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
