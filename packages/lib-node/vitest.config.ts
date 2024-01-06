import { defineProject } from "vitest/config";
import path from "node:path";

const root = path.resolve(__dirname);
export default defineProject({
  test: {
    alias: [{ find: /^@eavid\/lib-node/, replacement: path.resolve(root, "./src") }],
  },
});
