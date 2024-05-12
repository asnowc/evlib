import * as node_ps from "node:child_process";
import {
  readableToReadableStream,
  writableToWritableStream,
} from "../stream/stream_transform.js";
import { WritableStream, ReadableStream } from "node:stream/web";
import { OnceEventTrigger } from "evlib";

/** @public */
export type ClosedState = Readonly<{
  code: null | number;
  signal: NodeJS.Signals | null;
}>;
/** @public */
export class SubProcess {
  constructor(protected nodeCps: node_ps.ChildProcess) {
    nodeCps.once("exit", (code, signal) => {
      this.closedState = Object.freeze({ code, signal });
      this.exitEvent.emit(this.closedState);
    });
    nodeCps.once("close", (code, signal) => {
      (this as any).closed = true;
      this.closeEvent.emit(this.closedState!);
    });
    nodeCps.on("error", () => {});
    if (typeof nodeCps.send !== "function")
      nodeCps.send = () => {
        throw new Error("The communication protocol is not connected");
      };

    this.spawnFile = nodeCps.spawnfile;
    this.spawnargs = nodeCps.spawnargs;
    this.stdin = nodeCps.stdin ? writableToWritableStream(nodeCps.stdin) : null;
    this.stdout = nodeCps.stdout
      ? readableToReadableStream(nodeCps.stdout)
      : null;
    this.stderr = nodeCps.stderr
      ? readableToReadableStream(nodeCps.stderr)
      : null;
    this.stdio = [this.stdin, this.stdout, this.stderr];
    this.pid = nodeCps.pid!;
  }

  readonly closed: boolean = false;
  get killed() {
    return this.nodeCps.killed;
  }
  closedState: ClosedState | null = null;
  readonly pid: number;
  readonly spawnFile: string;
  readonly spawnargs: readonly string[];
  readonly stdio: readonly [
    WritableStream<Buffer> | null,
    ReadableStream<Buffer> | null,
    ReadableStream<Buffer> | null
  ];
  readonly stdin: null | WritableStream<Buffer>;
  readonly stdout: null | ReadableStream<Buffer>;
  readonly stderr: null | ReadableStream<Buffer>;

  /** 在进程结束并且子进程的 stdio 流关闭后触发
   * @alpha
   */
  protected readonly closeEvent = new OnceEventTrigger<ClosedState>();
  watchClose(signal?: AbortSignal) {
    return this.closeEvent.getPromise(signal);
  }
  /**
   * 触发 'exit' 事件时，子进程 stdio 流可能仍处于打开状态
   */
  protected readonly exitEvent = new OnceEventTrigger<ClosedState>();
  watchExit(signal?: AbortSignal) {
    return this.exitEvent.getPromise(signal);
  }
  kill(signal?: NodeJS.Signals | number): void {
    this.nodeCps.kill(signal);
  } /* c8 ignore next 3 */
  ref() {
    this.nodeCps.ref();
  } /* c8 ignore next 3 */
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
