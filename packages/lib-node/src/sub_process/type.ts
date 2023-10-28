import { Handle } from "../internal/handle.js";

type StdioFlag = "pipe" | "overlapped" | "ignore";
type Stdio = StdioFlag | Handle;

interface SpawnCommonOptions {
    env?: Record<string, string | number | boolean>;
    cwd?: string;
    gid?: number;
    uid?: number;

    /**
     * @remarks 扩展共享资源
     */
    sharedResource?: (Handle | number | null)[];
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
    args?: string[];
}

/** @public */
export interface SpawnOptions extends SpawnCommonOptions {
    /** @remarks  准备子进程独立于其父进程运行。 具体行为取决于平台，参见 [options.detached](https://nodejs.cn/api/child_process.html#optionsdetached) */
    detached?: boolean;
}
/** @public */
export interface SpawnSyncResult {
    pid: number;
    stdout: Buffer;
    stderr: Buffer;
    status: number | null;
    signal: NodeJS.Signals | null;
    error?: Error | undefined;
}
/** @public */
export interface SpawnSyncOptions extends SpawnCommonOptions {
    maxBuffer?: number;
}
