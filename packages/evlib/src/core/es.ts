declare const window: any;
declare const Deno: any;
/**
 * @public
 * @remarks ECMA年份版本
 */
export const ECMA_VERSION = getESVersion();

function getESVersion(): number {
  let version: number;
  if (!Array.isArray) {
    version = 2013;
  } else {
    try {
      Promise.prototype;
    } catch (error) {
      version = 2014;
    }
  }
  if (!Array.prototype.includes) {
    version = 2015; //2015
  } else if (!String.prototype.padStart) {
    version = 2016;
  } else if (!Promise.prototype.finally) {
    version = 2017;
  } else if (!globalThis.BigInt) {
    version = 2018;
  } else if (!Promise.allSettled) {
    version = 2019;
  } else if (!String.prototype.replaceAll) {
    version = 2020;
  } else if (!Array.prototype.at) {
    version = 2021;
  } else {
    version = 2022; //ES2022
  }
  return version;
}
/**
 * @public
 * @remarks JS运行时
 */
export const runtimeEngine = getEngine();
function getEngine(): "node" | "browser" | "deno" | "bun" | "unknown" {
  try {
    if (typeof Deno.version.deno === "string") return "deno";
  } catch (error) {}
  try {
    window.window.window;
    return "browser";
  } catch (error) {}
  if (typeof (globalThis as any).process?.version === "string") {
    return "node";
  }
  return "unknown";
}

export interface ModuleMeta {
  /** 模块文件夹 */
  dirname: string;
  /** 模块路径。对应 URL 的 pathname */
  filename: string;
}
export function paseModMeta(meta: { url: string }): ModuleMeta {
  const url = paseURL(meta.url);
  const filename = url.pathname;
  const index = filename.lastIndexOf("/");
  const dirname = index === 0 ? "/" : filename.slice(0, index);

  return {
    dirname,
    filename,
  };
}
function paseURL(url: string) {
  const res = url.match(/^(?<proto>\w+:)\/\/(?<host>[^\/]*)(?<tail>\/.*)?$/)?.groups;
  if (!res) throw new Error("无效的URL");
  const { proto: protocol, host } = res;
  const path = res.tail ?? "/";
  let pathname = "/",
    query = "",
    hash = "";
  if (path !== "/") {
    const res = path.match(/(?<pathname>[^?]*)(?<query>[^\#]*)(?<hash>.*)$/)?.groups!;
    query = res.query;
    hash = res.hash;
  }
  return {
    protocol,
    host,
    pathname,
    query,
    hash,
  };
}
