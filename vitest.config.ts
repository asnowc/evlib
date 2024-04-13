import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(__dirname, "packages");

const evlibExclude: string[] = [
  "packages/evlib/src/errors",
  "packages/evlib/src/*.ts",
];
export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/__mocks__", "**/*.assert.ts", "**/*.js", ...evlibExclude],
      include: ["packages/*/src/*/*.ts"],
    },
  },
});
