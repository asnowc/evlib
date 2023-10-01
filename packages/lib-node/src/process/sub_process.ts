import * as node_ps from "node:child_process";
import * as net from "node:net";
import type * as dgram from "node:dgram";
import { readableToReadableStream, writableToWritableStream } from "../stream/stream_transform.js";
import { WritableStream, ReadableStream } from "node:stream/web";
import { Listenable } from "#evlib";

type HandleObj = net.Socket | net.Server | dgram.Socket;
export type Handle = HandleObj | number | "ipc";
export namespace NodeRaw {
    type Stdio = undefined | null | "inherit" | "ignore" | "pipe" | "overlapped" | Handle;

    export interface SpawnOptions {
        file: string;
        envPairs?: string[];
        cwd?: string;
        args?: string[];
        detached?: boolean;
        stdio?: Stdio | Stdio[];

        gid?: number;
        uid?: number;
        serialization?: "json" | "advanced";
        windowsHide: boolean;
        windowsVerbatimArguments: boolean;
    }
    export interface ChildProcess extends node_ps.ChildProcess {
        new (): ChildProcess;
        spawn(options: SpawnOptions): void;
    }
}

type ClosedState = Readonly<{ code: null | number; signal: NodeJS.Signals | null; kill?: true }>;
/** @public */
export class SubProcess {
    constructor(protected nodeCps: NodeRaw.ChildProcess) {
        nodeCps.on("exit", (code, signal) => {
            if (this.closedState) return;
            this.closedState = Object.freeze({ code, signal });
            this.$close.emit(this.closedState);
        });
        nodeCps.on("close", (code, signal) => {
            if (this.closedState) return;
            this.closedState = Object.freeze({ code, signal });
            this.$close.emit(this.closedState);
        });
        nodeCps.on("error", () => {});
        nodeCps.on("message", (arg) => this.$message.emit(arg));
        nodeCps.on("disconnect", () => this.$disconnect.emit());
        if (typeof nodeCps.send !== "function")
            nodeCps.send = () => {
                throw new Error("The communication protocol is not connected");
            };

        this.spawnFile = nodeCps.spawnfile;
        this.spawnargs = nodeCps.spawnargs;
        this.stdio = [
            nodeCps.stdin ? writableToWritableStream(nodeCps.stdin) : null,
            nodeCps.stdout ? readableToReadableStream(nodeCps.stdout) : null,
            nodeCps.stderr ? readableToReadableStream(nodeCps.stderr) : null,
        ];

        this.pid = nodeCps.pid!;
    }
    get closed() {
        return Boolean(this.closedState);
    }
    closedState: ClosedState | null = null;
    readonly pid: number;
    readonly spawnFile: string;
    readonly spawnargs: readonly string[];
    readonly stdio: [WritableStream<Buffer> | null, ReadableStream<Buffer> | null, ReadableStream<Buffer> | null];

    /**
     * @alpha
     */
    $close = new Listenable<{ code: null | number; signal: NodeJS.Signals | null; kill?: true }>();
    $message = new Listenable<unknown>();
    $disconnect = new Listenable<void>();
    get connected() {
        return this.nodeCps.connected;
    }
    send(msg: any, handle?: HandleObj) {
        return new Promise((resolve) => {
            this.nodeCps.send(msg, handle as any, resolve);
        });
    }
    /** @remarks 与 node 进程断开通信 */
    disconnect() {
        this.nodeCps.disconnect();
    }
    kill(signal?: NodeJS.Signals | number) {
        const res = this.nodeCps.kill(signal);

        if (res) {
            this.closedState = Object.freeze({ kill: true, code: null, signal: null });
            this.$close.emit(this.closedState);
        }
        return res;
    }
    ref() {
        this.nodeCps.ref();
    }
    unref() {
        this.nodeCps.unref();
    }
}

/**
 * node进程通信协议:
 *  NODE_CHANNEL_FD:number //正整数, fd
 *  NODE_CHANNEL_SERIALIZATION_MODE:"json"|"adnv" 是否启用高级序列号
 *
 */
