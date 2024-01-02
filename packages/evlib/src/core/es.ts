declare const window: any;
declare const Deno: any;
/**
 * @public
 * @remarks ECMA年份版本
 */
export const ECMA_VERSION = getESVersion();

function getESVersion(): number {
  let version: number;
  if (!Array.isArray) {
    version = 2013;
  } else {
    try {
      Promise.prototype;
    } catch (error) {
      version = 2014;
    }
  }
  if (!Array.prototype.includes) {
    version = 2015; //2015
  } else if (!String.prototype.padStart) {
    version = 2016;
  } else if (!Promise.prototype.finally) {
    version = 2017;
  } else if (!globalThis.BigInt) {
    version = 2018;
  } else if (!Promise.allSettled) {
    version = 2019;
  } else if (!String.prototype.replaceAll) {
    version = 2020;
  } else if (!Array.prototype.at) {
    version = 2021;
  } else {
    version = 2022; //ES2022
  }
  return version;
}
/**
 * @public
 * @remarks JS运行时
 */
export const runtimeEngine = getEngine();
function getEngine(): "node" | "browser" | "deno" | "bun" | "unknown" {
  try {
    if (typeof Deno.version.deno === "string") return "deno";
  } catch (error) {}
  try {
    window.window.window;
    return "browser";
  } catch (error) {}
  if (typeof (globalThis as any).process?.version === "string") {
    return "node";
  }
  return "unknown";
}
