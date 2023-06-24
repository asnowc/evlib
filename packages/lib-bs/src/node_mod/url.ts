import * as itURL from "@asnc/tslib/std/Url";
import { err } from "@asnc/tslib/std/Err";
import { platform as os_platform } from "./os.js";
const POSIX = os_platform() !== "win32";
const matchURL = itURL.matchURL;
type urlFormat = ReturnType<typeof matchURL>;
type itURL = itURL.URL;

const bsProto: { [key: string]: number } = {
    //内置端口
    ftp: 21,
    file: 0,
    http: 80,
    https: 443,
    ws: 80,
    wss: 443,
};
export var SearchParams = itURL.SearchParams;
export default class URL extends itURL.URL {
    constructor(url: string, url2?: string) {
        super(url2 ? url2 : url);
        if (typeof url !== "string") throw err.argType(url, "string");
        if (url2) this.pathname = url;
        if (!this.protocol) throw err.arg(url, "url不正确");
        this.searchParams = <any>undefined;
        Object.defineProperty(this, "searchParams", {
            configurable: false,
            writable: false,
            enumerable: true,
            value: this,
        });
    }
    readonly searchParams: InstanceType<typeof SearchParams>;
    set protocol(val: string) {
        if (typeof val !== "string") throw err.argType(val, "string");

        if (val.endsWith(":")) val = val.slice(1, val.length - 1);

        if (val !== "file" && !this.hostname) return;
        let poto = super.protocol;
        if (poto === "") super.protocol = val;
        else {
            let keys = Object.keys(bsProto);
            let x,
                y,
                len = keys.length;
            for (let i = 0; i < len; i++) {
                const it = keys[i];
                if (it === val) x = true;
                if (it === poto) y = true;
            }
            if (x && y) super.protocol = val;
            //只有同时特殊协议才能更改,或者都不是特殊协议才能更改
            else return;
        }
    }
    get protocol() {
        let poto = super.protocol;
        return poto === "" ? poto : poto + ":";
    }
    set port(val: number | string) {
        if (typeof val !== "number" && typeof val !== "string") throw err.argType(val, "number|string");

        let def = bsProto[super.protocol];
        if (val == def) super.port = "";
        else {
            try {
                super.port = val;
            } catch (error) {
                throw err(error).shield();
            }
        }
    }
    get port() {
        return super.port;
    }
    get origin() {
        var host = this.host;
        var origin = this.protocol + "//";

        if (host) {
            let auth = this.auth;
            if (auth) auth += "@";
            origin += auth + host;
        } else origin += host;
        return origin;
    }
    set origin(val) {
        try {
            super.origin = val;
        } catch (error) {
            throw err(error).shield();
        }
    }
    createObjectURL(blob: any) {}
    revokeObjectURL(id: string) {}
    static domainToASCII = itURL.domainToASCII;
    static domainToUnicode = itURL.domainToUnicode;
    static fileURLToPath(url: URL) {
        if (!(url instanceof URL)) throw err.argType(url, URL);
        if (url.protocol !== "file:") throw err.arg(url, "url必须是file协议");
        url.decode = true;
        let path = url.toPath();
        url.decode = false;
        if (!path.isAbsolute) throw err.arg(url, "url的路径必须是绝对路径");
        path.sep = POSIX ? "/" : "\\";
        return path.pathname;
    }
    static pathToFileURL(path: string) {
        let urlo = new itURL.URL(path);
        urlo.origin = "file:///";
        urlo.hash = "";
        urlo.search = "";
        return urlo.href;
    }
    static format(
        url: URL,
        options?: {
            auth?: boolean;
            fragment?: boolean;
            search?: boolean;
            unicode?: boolean;
        }
    ) {
        if (!(url instanceof URL)) throw err.argType(url, URL);
        if (typeof options !== "object" || options === null) {
            options = {
                //默认值
                auth: true,
                fragment: true,
                search: false,
                unicode: true,
            };
        }
        let str = url.protocol + "//";
        if (options.auth) {
            str += url.username;
            let pass = url.password;
            str += pass ? ":" + pass : pass;
        }
        if (options.unicode) str += itURL.domainToUnicode(url.hostname);
        else str += url.hostname;
        str += ":" + url.port;
        str += url.pathname;
        if (options.search) str += url.search;
        str += url.hash;
        if (options.fragment) str = decodeURIComponent(str);
        return str;
    }
    static urlToHttpOptions(url: string): urlFormat {
        let str = matchURL(url);
        if (str && str.origin) return str;
        else throw err.arg(url, "url不正确");
    }

    /* 下面这些只是用来兼容nodejs */
    /* 返回名称列表 */
    keys() {
        let re = [];
        for (const it of this) re.push(it[0]);
        return re;
    }

    values() {
        let re = [];
        for (const it of this) re.push(it[1]);
        return re;
    }
    /*  */
    has(name: string) {
        try {
            return this.get(name) !== null;
        } catch (error) {
            throw err(error).shield();
        }
    }
    entries() {
        let re = [];
        for (const it of this) re.push(it);
        return re;
    }
    forEach(fn: Function, thisArg: object = this) {
        if (typeof fn !== "function") throw err.argType(fn, "function");
        if (typeof thisArg !== "object" || thisArg === null) throw err.argType(fn, "object");
        for (const it of this) {
            Reflect.apply(fn, thisArg, [it]);
        }
    }
}
