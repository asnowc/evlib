import { defineProject } from "vitest/config";
import path from "node:path";

const root = path.resolve(__dirname);
export default defineProject({
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
