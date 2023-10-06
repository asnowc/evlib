export * from "@rollup/plugin-typescript";
export * from "@rollup/plugin-node-resolve";
import typescript_i from "@rollup/plugin-typescript";

export const typescript: typeof typescript_i.default = typescript_i as any;
