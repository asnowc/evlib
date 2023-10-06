import { RollupOptions } from "rollup";
import { RollupTypescriptOptions } from "@rollup/plugin-typescript";
import { dePromise } from "../lib/mod.js";

import { typescript, nodeResolve, RollupNodeResolveOptions } from "./plugins.js";
export * from "rollup";
/**
 * @alpha
 */
export interface ExtraRollupConfig extends RollupOptions {
    extra?: {
        typescript?: RollupTypescriptOptions;
        resolve?: RollupNodeResolveOptions;
    };
}
/**
 * @alpha
 */
export function defineEvConfig(options: ExtraRollupConfig) {
    const { extra = {}, ...rollupOptions } = options;
    const typescriptPlu = typescript(extra.typescript);
    const resolvePlu = nodeResolve(extra.resolve);

    rollupOptions.plugins = dePromise(rollupOptions.plugins, (plugin) => {
        if (!(plugin instanceof Array)) {
            if (typeof plugin === "object" && plugin) {
                plugin = [plugin];
            } else plugin = [];
        }
        plugin.unshift(typescriptPlu, resolvePlu); //typescript 必须在 node resolve 前面
        return plugin;
    });
    return rollupOptions;
}
