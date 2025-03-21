import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(__dirname);
export default defineConfig({
  esbuild: { target: "es2022" },
  test: {
    alias: [
      { find: /^evlib$/, replacement: path.resolve(root, "src/core/mod.ts") },
      { find: /^evlib(?=\/[^\/]+$)/, replacement: path.resolve(root, "src") }, //只匹配 evlib/xxxx ; 不匹配 evlib/xxx/xxx
    ],
    coverage: {
      include: ["src/***.ts"],
    },
  },
});
