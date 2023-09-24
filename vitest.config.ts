import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(__dirname, "packages");

export default defineConfig({
    test: {
        coverage: {
            exclude: ["**/__mocks__"],
        },
    },
});
