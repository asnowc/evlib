// @ts-check
import { defineEvConfig, tools } from "@eavid/lib-dev/rollup"
import * as path from "node:path";


const dir = process.cwd();
let files = await tools.getDirFiles(path.resolve(dir, "src")) //获取src目录下的入口文件
files = files.filter((path) => path.endsWith(".ts")) //排除 src/tsconfig.json
const corePath = path.resolve(dir, "src/core/mod.ts")
files.push(corePath)

export default defineEvConfig({
    input: files,
    output: {
        dir: "dist",
        chunkFileNames: "internal/[name].js",
        minifyInternalExports: false,
        sourcemap: false,
        entryFileNames(info) {
            let add = ""
            if (info.facadeModuleId === corePath) add = "core/"
            console.log(`output: ${add + info.name}.js`);
            return add + "[name].js"
        }
    },

    external: [/^evlib$/],
    extra: {
        typescript: {
            compilerOptions: {
                "target": "ES2022",
                module: "NodeNext",
                outDir: "./dist",
                rootDir: "./src",
                noEmit: false,
                declaration: true,
                declarationMap: true
            },
        }
    }
});
