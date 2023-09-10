import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(__dirname, "packages");

export default defineConfig({
    test: {
        coverage: {
            exclude: ["**/__mocks__"],
        },
        alias: [
            { find: /^evlib$/, replacement: path.resolve(root, "evlib/src/core/index.js") },
            { find: /^evlib(?=\/[^\/]+$)/, replacement: path.resolve(root, "evlib", "src") }, //只匹配 evlib/xxxx ; 不匹配 evlib/xxx/xxx
            { find: /^@eavid\/lib-node/, replacement: path.resolve(root, "lib-node/src") },
        ],
    },
});
