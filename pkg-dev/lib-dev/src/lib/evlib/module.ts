import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
/**
 * @public
 * @remarks 模块的位置信息
 */
export interface ModulePathInfo {
    dir: string;
    file: string;
}
/**
 * @public
 * @remarks 获取ECMA 模块的位置信息
 */
export function getModuleInfo({ url }: ImportMeta): ModulePathInfo {
    const file = fileURLToPath(url);

    return {
        file,
        dir: resolve(file, ".."),
    };
}
