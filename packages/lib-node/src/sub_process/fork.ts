import { rawSpawn } from "./private.js";
import { SpawnOptions } from "./type.js";
import { OnceEventTrigger, EventTrigger } from "evlib";
import { Handle } from "../internal/handle.js";
import { SubProcess } from "./sub_process.js";
import { ChildProcess } from "node:child_process";
const exePath = process.execPath;

/**
 *
 * @public
 * @remarks 创建 node 子进程
 * @param file - node 模块的路径
 */
export function fork(file: string, options: SpawnOptions = {}) {
  const args = options.args ?? [];
  return rawSpawn(
    exePath,
    { ...options, args: [file, ...args] },
    { nodeIPC: true }
  ).then((cps) => new NodeSubProcess(cps));
}

/**
 * @beta
 */
export class NodeSubProcess extends SubProcess {
  constructor(nodeCps: ChildProcess) {
    super(nodeCps);
    nodeCps.on("message", (arg) => this.messageEvent.emit(arg));
    nodeCps.on("disconnect", () => this.disconnectEvent.emit());
  }
  readonly messageEvent = new EventTrigger<unknown>();
  protected readonly disconnectEvent = new OnceEventTrigger<void>();
  watchDisconnect(signal?: AbortSignal) {
    return this.disconnectEvent.getPromise(signal);
  }
  get connected() {
    return this.nodeCps.connected;
  }
  send(msg: any, handle?: Handle | number) {
    return new Promise((resolve) => {
      this.nodeCps.send(msg, handle as any, resolve);
    });
  }
  /** @remarks 与 node 进程断开通信 */
  disconnect() {
    this.nodeCps.disconnect();
  }
}
