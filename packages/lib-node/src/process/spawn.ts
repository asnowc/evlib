import * as node_ps from "node:child_process";
import { NodeRaw, SubProcess, Handle } from "./sub_process.js";
const Cps = node_ps.ChildProcess as any as NodeRaw.ChildProcess;

type StdioFlag = "pipe" | "overlapped" | "ignore";
type Stdio = StdioFlag | Handle;
/** @public */
export interface SpawnOptions {
    args?: string[];
    env?: Record<string, string | number | boolean>;
    cwd?: string;
    gid?: number;
    uid?: number;
    /** @remarks  准备子进程独立于其父进程运行。 具体行为取决于平台，参见 [options.detached](https://nodejs.cn/api/child_process.html#optionsdetached) */
    detached?: boolean;
    /**
     * @remarks 扩展共享资源
     */
    sharedResource?: (Handle | null)[];
    /**
     * @defaultValue [0,1,2]
     * @remarks
     * 'pipe': 在子进程和父进程之间创建管道。 管道的父端作为 subprocess.stdio[fd] 对象上的 child_process 对象的属性公开给父级。 为 fds 0、1 和 2 创建的管道也可分别用作 subprocess.stdin、subprocess.stdout 和 subprocess.stderr。 这些不是实际的 Unix 管道，因此子进程不能通过它们的描述符文件使用它们，例如 /dev/fd/2 或 /dev/stdout。
     * 'overlapped': 与 'pipe' 相同，只是在句柄上设置了 FILE_FLAG_OVERLAPPED 标志。 这对于子进程的 stdio 句柄上的重叠 I/O 是必需的。 有关详细信息，请参阅 文档。 这与非 Windows 系统上的 'pipe' 完全相同。
     * 'ignore': 指示 Node.js 忽略子项中的 fd。 虽然 Node.js 将始终为其生成的进程打开 fds 0、1 和 2，但将 fd 设置为 'ignore' 将导致 Node.js 打开 /dev/null 并将其附加到子进程的 fd。
     * Handle: 与子进程共享引用 tty、文件、套接字或管道的可读或可写流。 流的底层文件描述符在子进程中被复制到与 stdio 数组中的索引对应的 fd。 流必须有一个底层描述符（文件流在 'open' 事件发生之前没有）。
     * number: 整数值被解释为在父进程中打开的文件描述符。 它与子进程共享，类似于 <Stream> 对象的共享方式。 Windows 不支持传递套接字。
     */
    stdio?: StdioFlag | [Stdio, Stdio, Stdio];

    /**
     * @beta
     * @remarks  创建一个 IPC 通道，用于在父子之间传递消息/文件描述符。
     *  一个 ChildProcess 最多可以有一个 IPC stdio 文件描述符。
     * 设置此选项可启用 subprocess.send() 方法。
     * 如果子进程是 Node.js 进程，IPC 通道的存在将启用 process.send() 和 process.disconnect() 方法，以及子进程中的 'disconnect' 和 'message' 事件。
     * 不支持以 process.send() 以外的任何方式访问 IPC 通道 fd 或将 IPC 通道用于非 Node.js 实例的子进程。
     */
    createIPC?: boolean;
    windowsRawArguments?: boolean;
}

/** @public */
export async function spawn(file: string, options: SpawnOptions = {}): Promise<SubProcess> {
    return new Promise<SubProcess>((resolve, reject) => {
        const cps = new Cps();
        cps.on("spawn", () => {
            cps.off("error", reject);
            resolve(new SubProcess(cps));
        });
        cps.on("error", reject);

        cps.spawn(intiOptions(file, options));
    });
}

/**
 * @alpha
 * @remarks 创建 node 进程
 * @param file - js 文件的路径
 */
export function fork(file: string, options: SpawnOptions = {}): Promise<SubProcess> {
    const args = options.args ?? [];
    return spawn(process.execPath, { ...options, args: [file, ...args] });
}
// export function cmd(): Promise<SubProcess> {}

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

function intiOptions(file: string, options: SpawnOptions = {}) {
    const stdio: (Stdio | undefined | null)[] = [];
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
    if (options.createIPC) stdio.push("ipc");
    return {
        envPairs: initEnv(options.env),
        file,
        windowsHide: true,
        windowsVerbatimArguments: Boolean(options.windowsRawArguments),
        args,

        cwd: options.cwd,
        detached: options.detached,
        gid: options.gid,
        uid: options.uid,
        stdio,
    };
}
