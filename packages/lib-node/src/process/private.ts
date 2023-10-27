import * as cps from "node:child_process";
import { Handle } from "../internal/handle.js";
import { SpawnOptions, SpawnSyncOptions, SpawnSyncResult } from "./type.js";

export async function rawSpawn(
    exePath: string,
    options: SpawnOptions = {},
    internalOptions: {
        nodeIPC?: boolean;
        shell?: boolean;
    }
): Promise<cps.ChildProcess> {
    return new Promise<cps.ChildProcess>((resolve, reject) => {
        const childProcess = new cps.ChildProcess();
        childProcess.once("spawn", () => {
            childProcess.off("error", reject);
            resolve(childProcess);
        });
        childProcess.once("error", reject);
        const opt = intiOptions(exePath, options, internalOptions);
        (childProcess as any).spawn(opt);
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
        shell,
    } as cps.SpawnSyncOptionsWithBufferEncoding);
    Reflect.deleteProperty(result, "output");
    return result;
}

// export function spawnSync(file: string, options: CommandOptions = {}) {}
function copyProcessEnvToEnv(env: Record<string, string>, names: string[], optionEnv: Record<string, string>) {
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (process.env[name] && !Object?.hasOwn(optionEnv, name)) {
            env[name] = process.env[name]!;
        }
    }
}
const isZOS = (process.platform as string) === "os390";

function initEnv(optEnv?: Readonly<Record<string, any>>) {
    let env: Readonly<Record<string, string>>;
    if (optEnv) {
        env = optEnv;
        // process.env.NODE_V8_COVERAGE always propagates, making it possible to
        // collect coverage for programs that spawn with white-listed environment.
        copyProcessEnvToEnv(env, ["NODE_V8_COVERAGE"], optEnv);

        if (isZOS) {
            // The following environment variables must always propagate if set.
            const copyList = [
                "_BPXK_AUTOCVT",
                "_CEE_RUNOPTS",
                "_TAG_REDIR_ERR",
                "_TAG_REDIR_IN",
                "_TAG_REDIR_OUT",
                "STEPLIB",
                "LIBPATH",
                "_EDC_SIG_DFLT",
                "_EDC_SUSV3",
            ];
            copyProcessEnvToEnv(env, copyList, optEnv);
        }
    } else env = process.env as any;
    const envPairs: string[] = [];
    // Prototype values are intentionally included.

    let envKeys = Object.keys(env);

    if (process.platform === "win32") {
        // On Windows env keys are case insensitive. Filter out duplicates,
        // keeping only the first one (in lexicographic order)
        const sawKey = new Set();
        const filtersKey: string[] = [];
        for (let i = 0; i < envKeys.length; i++) {
            const key = envKeys[i];
            const uppercaseKey = key.toUpperCase();
            if (!sawKey.has(uppercaseKey)) {
                sawKey.add(uppercaseKey);
                filtersKey.push(key);
            }
        }
        envKeys = filtersKey;
    }

    for (const key of envKeys) {
        const value = env[key];
        if (typeof value !== undefined) {
            envPairs.push(`${key}=${value}`);
        }
    }
    return envPairs;
}

function intiOptions<T extends SpawnOptions>(
    file: string,
    options: T,
    internalOptions: {
        nodeIPC?: boolean;
        shell?: boolean;
    }
): NodeRaw.SpawnOptions & { stdio: NodeRaw.Stdio[] } {
    const { nodeIPC, shell } = internalOptions;
    const stdio: NodeRaw.Stdio[] = [];
    {
        const rawStdio = options.stdio;
        if (Array.isArray(rawStdio)) {
            stdio[0] = rawStdio[0];
            stdio[1] = rawStdio[1];
            stdio[2] = rawStdio[2];
        } else {
            const rep = typeof rawStdio === "string" ? rawStdio : undefined;
            stdio[0] = rep;
            stdio[1] = rep;
            stdio[2] = rep;
        }
    }
    const args = [file];
    for (let i = 0, rawArgs = options.args ?? []; i < rawArgs.length; i++) {
        args[i + 1] = rawArgs[i];
    }

    if (options.sharedResource?.length) stdio.push(...options.sharedResource);
    if (nodeIPC) stdio!.push("ipc");
    return {
        envPairs: initEnv(options.env),
        file,
        windowsHide: true,
        // windowsVerbatimArguments: Boolean(options.windowsRawArguments),
        args,

        shell,
        cwd: options.cwd,
        detached: options.detached,
        gid: options.gid,
        uid: options.uid,
        stdio,
    };
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
