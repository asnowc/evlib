import * as fs from "node:fs/promises";
import * as path from "node:path";
import { outputFile } from "fs-extra/esm";
import { fileURLToPath } from "node:url";

async function readFiles(absPath: string, fx: (absPath: string) => void): Promise<string[]> {
    let errors: string[] = [];
    let info;
    try {
        info = await fs.stat(absPath);
    } catch (error) {
        errors.push(absPath + ":  " + (error as Error).message);
        return errors;
    }

    if (info.isFile()) {
        fx(absPath);
        return errors;
    } else if (info.isDirectory()) {
        let files: string[];
        try {
            files = await fs.readdir(absPath);
        } catch (error) {
            errors.push(absPath + ":  " + (error as Error).message);
            return errors;
        }
        //todo: 并行优化
        for (const filename of files) {
            const subErrors = await readFiles(path.resolve(absPath, filename), fx);
            errors = errors.concat(subErrors);
        }
    }
    return errors;
}

let homeDir = path.resolve(fileURLToPath(import.meta.url), "../..");
let srcDir = path.resolve(homeDir, "lib_cjs");
let distDir = path.resolve(homeDir, "lib");
const code = `export * from "#home`;

await fs.rm(distDir, { recursive: true });
let errors = await readFiles(srcDir, function (absPath: string) {
    let relPath = path.relative(srcDir, absPath);
    if (path.sep === "\\") relPath = relPath.replaceAll("\\", "/");

    let contentText = code + `/${relPath}";`;
    let writeAbsPath = path.resolve(distDir, relPath.replace(/\.js/, ".mjs"));
    return outputFile(writeAbsPath, contentText, "utf-8").catch(() => console.log("文件写入失败:" + writeAbsPath));
});

console.log("完成");
for (const err of errors) {
    console.log(err);
}
