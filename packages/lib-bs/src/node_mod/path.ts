import Path from "@asnc/tslib/std/Path";
import { err } from "@asnc/tslib/std/Err";
import { osPlatform, cwd } from "./internal/base.js";
export function basename(path: string, ext?: string) {
    try {
        var name = parse(path).base;
        if (typeof ext === "string" && name.endsWith(ext)) return name.slice(0, name.length - ext.length);
        return name;
    } catch (error) {
        throw err(error).shield();
    }
}
export function dirname(path: string) {
    try {
        return parse(path).dir;
    } catch (error) {
        throw err(error).shield();
    }
}
export function extname(path: string) {
    try {
        return parse(path).ext;
    } catch (error) {
        throw err(error).shield();
    }
}

interface pathFormat {
    dir?: string;
    root?: string;
    base?: string;
    name?: string;
    ext?: string;
}
/* base>name+ext  dir>root */
export function format(pathObject: Partial<pathFormat>) {
    if (typeof pathObject !== "object" || pathObject === null) throw err.argType(pathObject, "object");
    let { root, dir, base, name, ext } = pathObject;

    let path: string | undefined;
    if (dir) path = dir;
    else if (root) path = root;

    if (!base) base = name ? name + (ext ?? "") : "";
    if (!base) path = root;
    if (!path) throw err.arg(pathObject, "root、dir、至少提供一个");

    if (base) path += sep + base;
    return path;
}
export function isAbsolute(path: string) {
    if (win32) return path.search(/^\w+:/) === 0;
    else return path.startsWith("/");
}
export function join(...paths: string[]) {
    let arg = arguments,
        href = "";
    for (let i = 0; i < arg.length; i++) {
        let it = arg[i];
        if (typeof it !== "string") throw err.argType(it, "string", i);
        href += it + "/";
    }
    return normalize(href);
}
export function normalize(path: string) {
    try {
        let pt = new Path(path).pathname;
        if (pt.startsWith("." + sep)) pt = pt.slice(2);
        return pt;
    } catch (error) {
        throw err(error).shield();
    }
}
export function parse(path: string): { root: string; dir: string; name: string; base: string; ext: string } {
    if (typeof path !== "string") throw err.argType(path, "string");
    if (win32) var regExp = /^(?<dir>(?<root>\w+:[\\\/]?).*)?(?<base>(?<=[\/\\])(?<name>[^\\\/]*)(?<ext>\.[^.]+)?)?$/;
    else var regExp = /^(?<dir>(?<root>\/?).*)?(?<base>(?<=[\/\\])(?<name>[^\\\/]*)(?<ext>\.[^.]+)?)?$/;
    let rp = path.match(regExp);
    if (rp) {
        let { root, dir, name, base, ext } = <any>rp.groups;
        if (!root) root = "";
        if (dir.endsWith(sep)) dir = dir.slice(0, dir.length - 1);
        else if (!dir) dir = "";
        if (!base) base = "";
        if (!ext) ext = "";
        if (!name) name = "";
        return { root, dir, name, base, ext };
    } else return { root: "", dir: "", name: "", base: "", ext: "" };
}
export var posix = {};
export function relative(from: string, to: string) {
    try {
        var pt = new Path(from);
    } catch (error) {
        throw err(error).shield();
    }
    return pt.relative(to).pathname;
}
/* 返回绝对路径: 如果参数的合成最终的相对路径, 则以当前工作目录参考,返回绝对路径 */
export function resolve(...paths: string[]) {
    try {
        var path = new Path(join(...arguments));
    } catch (error) {
        throw err(error).shield();
    }
    if (!path.isAbsolute) path.unshift(cwd());
    return path.pathname;
}
export const win32 = osPlatform() === "win32";

export var delimiter = win32 ? ";" : ":"; //提供特定于平台的路径定界符： Windows:";"  POSIX:":"
export const sep = win32 ? "\\" : "//";
export function toNamespacedPath(path: string) {}
