declare const window: any;
declare const Deno: any;
/** ECMA年份版本
 * @public
 */
export const ECMA_VERSION: number = getESVersion();

/*@__NO_SIDE_EFFECTS__*/
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
    //@ts-ignore
  } else if (!Promise.finally) {
    version = 2018;
    //@ts-ignore
  } else if (!Promise.allSettled) {
    version = 2019;
    //@ts-ignore
  } else if (!String.prototype.replaceAll) {
    version = 2020;
    //@ts-ignore
  } else if (!Array.prototype.at) {
    version = 2021;
  } else {
    version = 2022; //ES2022
  }
  return version;
}
/** JS运行时
 * @public
 */
export const runtimeEngine: "node" | "browser" | "deno" | "bun" | "unknown" = getEngine();
/*@__NO_SIDE_EFFECTS__*/
function getEngine(): typeof runtimeEngine {
  try {
    if (typeof Deno.version.deno === "string") return "deno";
  } catch (error) {}
  try {
    if (typeof window === "object" && window.window === window) {
      return "browser";
    }
  } catch (error) {}
  try {
    //@ts-ignore
    if (typeof process.version === "string") return "node";
  } catch (error) {
  }
  return "unknown";
}
