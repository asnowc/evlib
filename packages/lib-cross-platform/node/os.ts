import * as base from "./internal/base.js";
type arch =
  | "arm"
  | "arm64"
  | "ia32"
  | "mips"
  | "mipsel"
  | "ppc"
  | "ppc64"
  | "s390"
  | "s390x"
  | "x32"
  | "x64";
interface networkInterfaces {
  /*分配的 IPv4 或 IPv6 地址*/
  address: string;
  /*IPv4 或 IPv6 网络掩码*/
  netmask: string;
  /*IPv4 或 IPv6*/
  family: string;
  /*网络接口的 MAC 地址*/
  mac: string;
  /*如果网络接口是不能远程访问的环回或类似接口，则为 true；否则为 false*/
  internal: boolean;
  /*数字的 IPv6 范围 ID（仅在 family 为 IPv6 时指定）*/
  scopeid: number;
  /*使用 CIDR 表示法的路由前缀分配的 IPv4 或 IPv6 地址。 如果 netmask 无效，则此属性设置为 null。*/
  cidr: string;
}
interface cpus {
  model: string;
  /* （以兆赫为单位） */
  speed: number;
  times: {
    /*  CPU 在用户模式下花费的毫秒数。 */
    user: number;
    /*  CPU 在良好模式下花费的毫秒数。 */
    nice: number;
    /*  CPU 在系统模式下花费的毫秒数。 */
    sys: number;
    /*  CPU 在空闲模式下花费的毫秒数。 */
    idle: number;
    /*  CPU 在中断请求模式下花费的毫秒数。 */
    irq: number;
  };
}
const nav = navigator;

/* 返回为其编译 Node.js 二进制文件的操作系统 CPU 架构。*/
export function arch(): arch {
  let re: any;
  return re;
}

/* 返回包含有关每个逻辑 CPU 内核的信息的对象数组。 */
export function cpus(): cpus[] {
  let re: any;
  return re;
}

/*  返回标识为其编译 Node.js 二进制文件的 CPU 的字节序的字符串。
        可能的值是大端序的 'BE' 和小端序的 'LE'。*/
export function endianness(): "BE" | "LE" {
  return "LE";
}
/* 以整数形式返回空闲的系统内存量（以字节为单位） */
export function freemem(): number {
  return 1;
}

/* 返回由 pid 指定的进程的调度优先级。 如果未提供 pid 或为 0，则返回当前进程的优先级。 */
export function getPriority(pid: number = 0): number {
  return 1;
}
/* 返回当前用户的主目录的字符串路径。 */
export function homedir(): string {
  return "";
}
/* 以字符串形式返回操作系统的主机名。 */
export function hostname(): string {
  return "";
}
/* 返回包含 1、5 和 15 分钟平均负载的数组。 */
export function loadavg(): number {
  return 1;
}

/* 返回包含已分配网络地址的网络接口的对象。
    返回对象上的每个键都标识一个网络接口。 关联的值是每个对象描述一个分配的网络地址的对象数组。 */
export function networkInterfaces(): networkInterfaces {
  let re: any = 0;
  return re;
}
export const platform = base.platform;
/* 以字符串形式返回操作系统。 */
export function release(): string {
  return "";
}
export function setPriority(priority: string, pid?: string): void {}
/* 以字符串形式返回操作系统默认的临时文件的目录。 */
export function tmpdir(): string {
  return "";
}
/* 以整数形式返回系统内存总量（以字节为单位） */
export function totalmem(): number {
  return 1;
}
/* 返回 uname(3) 返回的操作系统名称。 例如，它在 Linux 上返回 'Linux'，在 macOS 上返回 'Darwin'，在 Windows 上返回 'Windows_NT'。 */
export function type(): string {
  return "";
}
/* 以秒为单位返回系统正常运行时间。 */
export function uptime(): number {
  return 1;
}
/* 
options <Object>
    encoding <string> 用于解释结果字符串的字符编码。 如果 encoding 设置为 'buffer'，则 username、shell 和 homedir 的值将是 Buffer 实例。 默认值: 'utf8'。
返回: <Object>  返回有关当前有效用户的信息。 在 POSIX 平台上，这通常是密码文件的子集。 返回的对象包括 username、uid、gid、shell 和 homedir。 在 Windows 上，uid 和 gid 字段是 -1，而 shell 是 null。
os.userInfo() 返回的 homedir 的值由操作系统提供。 这与 os.homedir() 的结果不同，后者在回退到操作系统响应之前查询主目录的环境变量。
如果用户没有 username 或 homedir，则抛出 SystemError。
*/
export function userInfo(options: object): object {
  return <any>{};
}
/* 返回标识内核版本的字符串 */
export function version(): string {
  return "";
}
const ptStr = platform();
const isPOSIX = (function () {
  if (ptStr === "win32") return false;
  else return true;
})();

/* POSIX 上是 \n.  Windows 上是 \r\n */
export const EOL: "\n" | "\r\n" = isPOSIX ? "\n" : "\r\n";
/*  空设备的特定于平台的文件路径。 Windows 上是 \\.\nul     POSIX 上是 /dev/null */
export const devNull: "\\\\.\\nul" | "/dev/null" = isPOSIX
  ? "/dev/null"
  : "\\\\.\\nul";

/* 包含用于错误码、进程信号等的常用操作系统特定常量。 */
export const constants = {
  dlopen: {},
  errno: {},
  priority: {},
  signals: {},
  UV_UDP_REUSEADDR: 4,
};
