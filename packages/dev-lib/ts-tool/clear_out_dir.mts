import * as fsp from "node:fs/promises";
import { Stats } from "node:fs";
import * as path from "node:path";
import { Glob } from "glob";

async function readTsOutAndRootDir(tsConfigPath: string) {
    let data = await fsp.readFile(tsConfigPath, "utf-8");
    let json: Record<string, any> = JSON.parse(data)?.compilerOptions;
    let { baseUrl = path.resolve(tsConfigPath, ".."), rootDir = ".", outDir = "." } = json;
    rootDir = path.resolve(baseUrl, rootDir);
    outDir = path.resolve(baseUrl, outDir);
    return [rootDir, outDir];
}

/** 清除ts编译的多余文件 */
export async function clearTsOutDir(tsConfigPath: string) {
    let rootDir: string, outDir: string;
    try {
        [rootDir, outDir] = await readTsOutAndRootDir(tsConfigPath);
    } catch (error) {
        console.log("解析tsConfigPath出现异常:", JSON.stringify(error));
        return;
    }

    return compareAndDelete(outDir, (relPath) => {
        let res = relPath.match(/\.(?<exta>[mc])?js(\.map)$/); //输出文件和源映射
        let ext: string;
        if (res) ext = res.groups?.exta ?? "" + "ts";
        else {
            res = relPath.match(/\.d\.(?<exta>[mc])?ts$/); //声明文件
            if (res) ext = res.groups?.exta ?? "" + "ts";
            else return;
        }

        let tsRelPath = relPath.slice(0, -ext.length) + "." + ext;
        return fsp.stat(path.resolve(rootDir, tsRelPath));
    });
}
async function compareAndDelete(distDir: string, infoFx: (relPath: string) => Promise<Stats> | Stats | void) {
    const errors: any[] = [];
    for (const relPath of new Glob("**", { cwd: distDir })) {
        let absPath = path.resolve(distDir, relPath);
        try {
            let [distInfo, srcInfo] = await Promise.all([fsp.stat(absPath), infoFx(relPath)]);

            if (!srcInfo || getStatsType(distInfo) === getStatsType(srcInfo)) continue;
            await fsp.rm(absPath);
        } catch (error) {
            errors.push(error);
            continue;
        }
    }
}
function getStatsType(stats: Stats) {
    if (stats.isFile()) return "file";
    if (stats.isDirectory()) return "dir";
    if (stats.isSymbolicLink()) return "link";
    if (stats.isFIFO()) return "fifo";
    if (stats.isBlockDevice()) return "blockDevice";
    if (stats.isCharacterDevice()) return "characterDevice";
    if (stats.isSocket()) return "socket";
}
