// @ts-check
import { defineEvConfig, tools } from "@eavid/lib-dev/rollup";
import * as path from "node:path";

const dir = process.cwd();
const files = await tools.getDirFiles(path.resolve(dir, "src"));
export default defineEvConfig({
  input: files,
  output: {
    dir: "dist",
    chunkFileNames: "internal/[name].js",
    minifyInternalExports: false,
    sourcemap: false,
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
        declarationMap: true,
      },
    },
    resolve: { resolveOnly: [/^evlib/] },
  },
});
