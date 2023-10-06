import * as rollup from "@eavid/lib-dev/rollup"
import * as rollupTool from "@eavid/lib-dev/rollup/tool";
import * as path from "node:path";

/** @type {typeof import("@eavid/lib-dev/out/rollup/mod")} */
const { defineEvConfig, defineConfig } = rollup
/** @type {typeof import("@eavid/lib-dev/out/rollup/tool")} */
const { getDirFiles } = rollupTool


const dir = process.cwd();
let files = await getDirFiles(path.resolve(dir, "src")) //获取src目录下的入口文件
files = files.filter((path) => path.endsWith(".ts")) //排除 src/tsconfig.json
const corePath = path.resolve(dir, "src/core/index.ts")
files.push(corePath)

export default defineEvConfig({
    input: files,
    output: {
        dir: "dist",
        chunkFileNames: "internal/[name].js",
        minifyInternalExports: false,
        sourcemap: true,
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
