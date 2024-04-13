import * as cps from "node:child_process";
import type { Handle } from "../internal/handle.js";
import type { SpawnOptions, SpawnSyncOptions, SpawnSyncResult } from "./type.js";

export function rawSpawn(
  exePath: string,
  options: SpawnOptions = {},
  internalOptions: {
    nodeIPC?: boolean;
    shell?: boolean;
  },
  signal?: AbortSignal
): Promise<cps.ChildProcess> {
  return new Promise<cps.ChildProcess>((resolve, reject) => {
    let coverEnv: Record<string, string> | undefined;
    let env = options.env;
    if (env) {
      coverEnv = {};
      for (const key of Object.keys(env)) {
        let value = env[key];
        let type = typeof value;
        if (type === "number" || type === "boolean") {
          coverEnv[key] = String(value);
        } else if (type === "string") {
          coverEnv[key] = value as string;
        }
      }
    }
    const stdio = initStdio(options.stdio);
    if (options.sharedResource?.length) stdio.push(...options.sharedResource);
    if (internalOptions.nodeIPC) stdio.push("ipc");

    const childProcess = cps.spawn(exePath, options.args ?? [], {
      cwd: options.cwd,
      env: coverEnv,
      gid: options.gid,
      uid: options.uid,
      windowsHide: true,
      detached: options.detached,
      windowsVerbatimArguments: true,
      stdio: stdio as any,
      shell: internalOptions.shell,
      signal: signal,
    });
    childProcess.once("spawn", () => {
      childProcess.off("error", reject);
      resolve(childProcess);
    });
    childProcess.once("error", reject);
  });
}

export function rawSpawnSync(exePath: string, options: SpawnSyncOptions = {}, shell?: boolean): SpawnSyncResult {
  const result = cps.spawnSync(exePath, options.args ?? [], {
    cwd: options.cwd,
    env: options.env,
    gid: options.gid,
    uid: options.uid,
    maxBuffer: options.maxBuffer,
    encoding: "buffer",
    windowsHide: true,
    stdio: initStdio(options.stdio),
    shell,
  } as cps.SpawnSyncOptionsWithBufferEncoding);
  Reflect.deleteProperty(result, "output");
  return result;
}

function initStdio(rawStdio?: SpawnOptions["stdio"]) {
  const stdio: NodeRaw.Stdio[] = [];
  if (Array.isArray(rawStdio)) {
    stdio[0] = rawStdio[0] ?? "pipe";
    stdio[1] = rawStdio[1] ?? "pipe";
    stdio[2] = rawStdio[2] ?? "pipe";
  } else {
    const rep = typeof rawStdio === "string" ? rawStdio : undefined;
    stdio[0] = rep;
    stdio[1] = rep;
    stdio[2] = rep;
  }
  return stdio;
}

namespace NodeRaw {
  export type Hd = Handle | number | "ipc";
  export type Stdio = undefined | null | "inherit" | "ignore" | "pipe" | "overlapped" | Hd;

  export interface SpawnOptions {
    file: string;
    envPairs?: string[];
    cwd?: string;
    args?: string[];
    detached?: boolean;
    stdio?: Stdio | Stdio[];
    shell?: string | boolean;

    gid?: number;
    uid?: number;
    serialization?: "json" | "advanced";
    windowsHide: boolean;
    windowsVerbatimArguments?: boolean;
  }
}
