import { defineConfig, UserConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(__dirname, "packages");

export default defineConfig({
    test: {
        coverage: {
            exclude: ["**/__mocks__"],
        },
        alias: [
            { find: /^evlib$/, replacement: path.resolve(root, "evlib/src/core/index.js") },
            { find: /^evlib/, replacement: path.resolve(root, "evlib", "src") },
            { find: /^@eavid\/lib-node/, replacement: path.resolve(root, "lib-node/src") },
        ],
    },
});

function createMap(root: string, options: PackagesAlias[]) {
    return options.map((item): Alias => {
        return {
            find: item.find,
            replacement: item.replacement,
            customResolver(source: string, importer?: string) {
                if (!importer) return source;
                importer = path.resolve(importer);
                if (importer.startsWith(root)) {
                    let pkgName = getPkgDirName(importer);
                    if (!item.testPkgName || item.testPkgName.test(pkgName)) return path.resolve(root, pkgName, source);
                }
                return source;
            },
        };
    });
}
function getPkgDirName(absPath: string): string {
    let subStr = absPath.slice(root.length + 1);
    return subStr.slice(0, subStr.indexOf(path.sep));
}
type Alias = NonNullable<NonNullable<UserConfig["test"]>["alias"]> extends readonly (infer P)[] | object ? P : never;

interface PackagesAlias {
    find: RegExp;
    replacement: string;
    testPkgName?: RegExp;
}
