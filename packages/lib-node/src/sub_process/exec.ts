import { SpawnOptions, SpawnSyncOptions, SpawnSyncResult } from "./type.js";
import { SubProcess } from "./sub_process.js";
import { rawSpawn, rawSpawnSync } from "./private.js";

const platform = process.platform;

function initShellCmd(command: string, args: string[] = []) {
  command = [command, ...args].join(" ");
  let shell: string;
  let shellArgs: string[];
  if (platform === "win32") {
    shell = process.env.comspec || "cmd.exe";
    if (/^(?:.*\\)?cmd(?:\.exe)?$/i.exec(shell) !== null) {
      shellArgs = ["/d", "/s", "/c", `${command}`]; // '/d /s /c' is used only for cmd.exe.
      // windowsVerbatimArguments = true;
    } else shellArgs = ["-c", command];
  } else {
    if (platform === "android") shell = "/system/bin/sh";
    else shell = "/bin/sh";
    shellArgs = ["-c", command];
  }
  return { shell, shellArgs };
}

function toSpawnOptions(
  command: string,
  options: SpawnOptions & { shell?: string }
) {
  let { shell, args = [], ...opts } = options;
  if (!shell) {
    const { shell: defShell, shellArgs } = initShellCmd(command, args);
    shell = defShell;
    args = shellArgs;
  } else args = ["-c", command, ...args];
  return [shell, { ...opts, args } as any] as const;
}
/** 在shell上执行命令
 * @remarks 如果不没有指定 shell 在 windows 上默认为 process.env.ComSpec, 在 unix 上默认为 /bin/sh
 * @param command - 要执行的命令.
 * @example
 * ```js
 * exec("node a.js")
 * exec("node a.js arg1". { args:["arg2"] })
 * exec("node a.js",  { args:["arg1", "arg2"] })
 * ```
 * @public
 */
export function exec(
  command: string,
  options: SpawnOptions & { shell?: string } = {}
): Promise<SubProcess> {
  const [shell, opts] = toSpawnOptions(command, options);
  return rawSpawn(shell, opts, { shell: true }).then(
    (cps) => new SubProcess(cps)
  );
}
/**
 * @public
 * @remark exec 的同步版本
 */
/** @public */
export function execSync(
  command: string,
  options: SpawnSyncOptions & { shell?: string } = {}
): SpawnSyncResult {
  const [shell, opts] = toSpawnOptions(command, options);
  const result = rawSpawnSync(shell, opts, true);
  Reflect.deleteProperty(result, "output");
  return result;
}
