import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
/** 模块的位置信息
 * @public
 */
export interface ModulePathInfo {
  dir: string;
  file: string;
}
/** 获取ECMA 模块的位置信息
 * @public
 */
export function getModuleInfo({ url }: ImportMeta): ModulePathInfo {
  const file = fileURLToPath(url);

  return {
    file,
    dir: resolve(file, ".."),
  };
}
