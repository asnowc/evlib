


import * as rollup from "@eavid/lib-dev/rollup"
import * as rollupTool from "@eavid/lib-dev/rollup/tool";
import * as path from "node:path";

/** @type {typeof import("@eavid/lib-dev/out/rollup/mod")} */
const { defineEvConfig, defineConfig } = rollup
/** @type {typeof import("@eavid/lib-dev/out/rollup/tool")} */
const { getDirFiles } = rollupTool


const dir = process.cwd();
const files = await getDirFiles(path.resolve(dir, "src"))
export default defineEvConfig({
    input: files,
    output: {
        dir: "dist",
        chunkFileNames: "internal/[name].js",
        minifyInternalExports: false,
        sourcemap: true,
    },

    external: [/^evlib/],
    extra: {
        typescript: {
            tsconfig: "tsconfig.json",
            compilerOptions: {
                module: "NodeNext",
                outDir: "./dist",
                rootDir: "./src",
                noEmit: false,
                declaration: true,
                declarationMap: true
            },
        },
        resolve: { resolveOnly: [/^evlib/] }
    }
});
