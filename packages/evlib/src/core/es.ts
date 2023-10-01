declare const window: any;

/**
 * @public
 * @remarks ECMA年份版本
 */
export const ECMA_VERSION = getESVersion(true);

/** @param useYear 使用年份版本（2015、2016 ...）*/
function getESVersion(useYear?: boolean): number {
    let version: number;
    if (!Array.isArray) {
        version = 3;
    } else {
        try {
            Promise.prototype;
        } catch (error) {
            version = 5;
        }
    }
    if (!Array.prototype.includes) {
        version = 6; //2015
    } else if (!String.prototype.padStart) {
        version = 7;
    } else if (!Promise.prototype.finally) {
        version = 8;
    } else if (!globalThis.BigInt) {
        version = 9;
    } else if (!Promise.allSettled) {
        version = 10;
    } else if (!String.prototype.replaceAll) {
        version = 11;
    } else if (!Array.prototype.at) {
        version = 12;
    } else {
        version = 13; //ES2022
    }
    return useYear ? version + 9 : version;
}
/**
 * @public
 * @remarks JS运行时
 */
export let runtimeEngine: "node" | "browser" | "deno" | "bun" | "unknown" = "unknown";

try {
    window.window.window;
    runtimeEngine = "browser";
} catch (error) {
    if (typeof (globalThis as any).process?.version === "string") {
        runtimeEngine = "node";
    }
}
