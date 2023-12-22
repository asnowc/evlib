import { RollupOptions } from "rollup";
import { RollupTypescriptOptions } from "@rollup/plugin-typescript";
import { dePromise } from "../lib/mod.js";

import { typescript, nodeResolve, RollupNodeResolveOptions } from "./plugins.js";
export * from "rollup";
export * as tools from "./tool.js";
export * as plugins from "./plugins.js";
/**
 * @alpha
 */
export interface ExtraRollupConfig extends RollupOptions {
  extra?: {
    typescript?: RollupTypescriptOptions | boolean;
    resolve?: RollupNodeResolveOptions | boolean;
  };
}
/**
 * @alpha
 */
export function defineEvConfig(options: ExtraRollupConfig) {
  const { extra = {}, ...rollupOptions } = options;

  rollupOptions.plugins = dePromise(rollupOptions.plugins, (plugin) => {
    if (!(plugin instanceof Array)) {
      if (typeof plugin === "object" && plugin) {
        plugin = [plugin];
      } else plugin = [];
    }
    if (extra.typescript)
      plugin.unshift(typescript(typeof extra.typescript === "object" ? extra.typescript : undefined));
    if (extra.resolve) plugin.unshift(nodeResolve(typeof extra.resolve === "object" ? extra.resolve : undefined));
    return plugin;
  });
  return rollupOptions;
}
