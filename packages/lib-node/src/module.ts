import path from "node:path";
import { fileURLToPath } from "node:url";

/** @public */
export interface ModuleMeta {
  /** 模块目录. 对应 URL 的 pathname 的上一级. 在Windows上, 只有当 protocol 为 file: 时有意义*/
  dirname: string;
  /** 模块路径. 对应 URL 的 pathname. 在Windows上, 只有当 protocol 为 file: 时有意义 */
  filename: string;
  /** URL 的 pathname */
  pathname: string;
  protocol: string;
}
/** 解析模块信息
 * @public
 */
export function paseModMeta(meta: { url: string }): ModuleMeta {
  const url = new URL(meta.url);

  const pathname = decodeURI(url.pathname);
  let filename = pathname;
  if (url.protocol === "file:") {
    filename = fileURLToPath(url);
  }
  return {
    protocol: url.protocol,
    pathname,
    dirname: path.resolve(filename, ".."),
    filename: path.resolve(filename),
  };
}
