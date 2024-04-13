/* 
WHATWG 网址格式
├──────────┬──┬─────────────────────┬────────────────────────┬───────────────────────────┬───────┤
│ protocol │  │        auth         │          host          │           path            │ hash  │
│          │  │                     ├─────────────────┬──────┼──────────┬────────────────┤       │
│          │  │                     │    hostname     │ port │ pathname │     search     │       │
│          │  │                     │                 │      │          ├─┬──────────────┤       │
│          │  │                     │                 │      │          │ │    query     │       │
"  https:   //    user   :   pass   @ sub.example.com : 8080   /p/a/t/h  ?  query=string   #hash "
│ protocol │  │ username │ password │    hostname     │ port │          │                │       │
│          │  │          │          ├─────────────────┴──────┤          │                │       │
│          │  │          │          │          host          │          │                │       │
├──────────┴─────────────┴──────────┴────────────────────────┤          │                │       │
│                          origin                            │ pathname │     search     │ hash  │
├───────────────────────────────────┴────────────────────────┴──────────┴────────────────┴───────┤
│                                              href                                              │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
允许的字符:  ! # $ & ’ ( ) * + , - . / : ; = ? @ _ ~ 0-9 a-z A-Z
port 0~65535
*/

import { err } from "../tool/err.js";
import { Path, getPOSIXDefault } from "./path.js";
import * as punyCode from "./puny_code.js";
const POSIX = getPOSIXDefault();

export function domainToASCII(domain: string) {
  var domainArray = domain.split(".");
  var out: string[] = [];
  for (const it of domainArray) {
    out.push(it.match(/[^A-Za-z0-9-]/) ? "xn--" + punyCode.encode(it) : it);
  }
  return out.join(".");
}
export function domainToUnicode(domain: string) {
  var domainArray = domain.split(".");
  var out: string[] = [];
  for (const it of domainArray) {
    out.push(it.match(/^xn--/) ? punyCode.decode(it.slice(4)) : it);
  }
  return out.join(".");
}
/* url相关的正则表达式 */
const urlRegExp = (function () {
  var authStr = "(?<auth>(?<username>[^:]*)(:(?<password>.*)))";
  var hostStr = "(?<host>(?<hostname>[^:/@]+)(:(?<port>\\d+))?)";
  var originStr =
    "(?<origin>(?<protocol>.+?)://(" + authStr + "?@)?" + hostStr + "?)";
  var pathStr = "(?<path>(?<pathname>[^?#]+)?(?<search>\\?[^#]+)?)";
  var urlStr = originStr + "?(?<adst>" + pathStr + "?(?<hash>#.+)?)?";
  /* 
        hostname不能存在 ':'和'/'  (也不能有'@','@'会被当做auth里的值)
        port只能是数字,port前边必定是':',
    */
  return new RegExp("^" + urlStr);
})();

interface matchUrlGrup {
  origin?: string;
  protocol?: string;
  auth?: string;
  username?: string;
  password?: string;
  host?: string;
  hostname?: string;
  port?: string;
  path?: string;
  pathname?: string;
  search?: string;
  hash?: string;
}
/* 匹配URL */
export function matchURL(url: string) {
  if (typeof url !== "string") throw err.argType(url, "string");
  let re = <any>url.match(urlRegExp);
  return <matchUrlGrup>re.groups;
}

interface urlFragment {
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  port: number | "";
  /* 没有#号 */
  hash: string;
  //[key: string]: string | number | any[];
}
export class SearchParams extends Path {
  constructor(qe?: string | { [k: string]: string }) {
    super("", true);
    if (typeof qe === "string") this.search = qe;
    else if (typeof qe === "object" && qe !== null) {
      var keys = Object.keys(qe);
      try {
        for (const it of keys) this.append(it, qe[it]);
      } catch (error) {
        throw err(error).shield();
      }
    }
  }
  decode = false;
  #attDecode<T extends [string, string] | string>(val: T): T {
    if (this.decode) {
      if (typeof val === "string") val = <T>decodeURIComponent(val);
      else {
        val[0] = decodeURIComponent(val[0]);
        val[1] = decodeURIComponent(val[1]);
      }
    }
    return val;
  }
  #attEncode<T extends [string, string] | string>(val: T): T {
    if (typeof val === "string") val = <T>encodeURIComponent(val);
    else {
      val[0] = encodeURIComponent(val[0]);
      val[1] = encodeURIComponent(val[1]);
    }
    return val;
  }
  #query: [string, string][] = [];
  /* 返回''或以'?'开头的字符串 */
  get search() {
    var search = "";
    var query = this.#query;
    for (const it of query) {
      this.#attDecode(it);
      search += "&" + it[0] + "=" + it[1];
    }
    return search ? "?" + search.slice(1) : search;
  }
  /* 以'?'开头,  没有'?'开头会自动加上 */
  set search(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");
    let add = val.split("&");
    for (const it of add) {
      if (it === "") continue;
      let sp = it.indexOf("="),
        key,
        val;
      if (sp === -1) {
        key = it;
        val = "";
      } else {
        key = it.slice(0, sp);
        val = it.slice(sp + 1);
      }
      this.#query.push(this.#attEncode([key, val]));
    }
  }

  /* 将新的名称-值对追加到查询字符串。 */
  append(name: string, value: string) {
    if (typeof name !== "string") throw err.argType(name, "string");
    if (typeof value !== "string") throw err.argType(value, "string", 1);
    this.#query.push(this.#attEncode([name, value]));
  }
  /* 删除名称为 name 的所有名称-值对。 */
  delete(name: string) {
    if (typeof name !== "string") throw err.argType(name, "string");
    let list = this.#query;
    for (let i = 0; i < list.length; ) {
      const it = list[i];
      if (it[0] === name) list.splice(i, i + 1);
      else i++;
    }
  }
  /*  返回名称为 name 的第一个名称-值对的值。 如果没有这样的对，则返回 null。 */
  get(name: string): [string, string] | null {
    if (typeof name !== "string") throw err.argType(name, "string");
    name = encodeURIComponent(name);
    for (const it of this.#query)
      if (it[0] === name) return this.#attEncode([it[0], it[1]]);
    return null;
  }
  /* 返回名称为 name 的所有名称-值对的值。 如果没有这样的对，则返回空数组。 */
  getAll(name: string) {
    if (typeof name !== "string") throw err.argType(name, "string");
    name = encodeURIComponent(name);
    let re: [string, string][] = [];
    for (const it of this.#query)
      if (it[0] === name) re.push(this.#attDecode(it));
    return re;
  }
  /* 如果存在name, 设置第一个name的值,并删除所有名为name的键值对 */
  set(name: string, value: string) {
    let list = this.#query;
    var has = false;
    for (let i = 0; i < list.length; ) {
      const it = list[i];
      if (it[0] === name) {
        if (has) {
          list.splice(i, i + 1);
          continue;
        } else {
          it[1] = this.#attEncode(value);
          has = true;
        }
      }
      i++;
    }
  }
  sort() {}
  toString() {
    return this.search;
  }
  *[Symbol.iterator]() {
    for (const it of this.#query) {
      yield this.#attDecode([it[0], it[1]]);
    }
  }
}

/**
 * @description 地址类
 * @oveload ()
 * @overload (ads:string)
 * @param {string} ads 默认为"".  地址
 */
export class URL extends SearchParams {
  constructor(ads: string = "") {
    super();
    if (typeof ads !== "string") throw err.argType(ads, "string");
    this.href = ads;
  }
  decode = false; //是否获取解码后的字符
  #adsFragment = <urlFragment>{
    protocol: "",
    username: "",
    password: "",
    hostname: "",
    port: "",
    /* 没有#号 */
    hash: "",
  };
  #attEncode(str: string, type?: string): string {
    var ddd: any = {
      username: new Set([
        33, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53,
        54, 55, 56, 57, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78,
        79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 95, 97, 98, 99, 100,
        101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114,
        115, 116, 117, 118, 119, 120, 121, 122, 126,
      ]),
      pathname: new Set([
        33, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 47, 48, 49, 50, 51, 52, 53,
        54, 55, 56, 57, 58, 59, 61, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
        75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 93,
        94, 95, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
        110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 124,
        126,
      ]),
      hash: new Set([
        33, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
        52, 53, 54, 55, 56, 57, 58, 59, 61, 63, 64, 65, 66, 67, 68, 69, 70, 71,
        72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89,
        90, 91, 92, 93, 94, 95, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106,
        107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
        121, 122, 123, 124, 125, 126,
      ]),
    };
    ddd.password = ddd.username;
    ddd.search = ddd.pathname;
    let encode = "";

    if (type === "hostname") return domainToASCII(str);
    else if (type) {
      let bj: any = <{ save: Set<number>; del: Set<number> }>ddd[type];
      if (bj) {
        for (let i = 0; i < str.length; i++) {
          let char = str[i];
          if (!bj.has(char.charCodeAt(0))) char = encodeURIComponent(char);
          encode += char;
        }
        return encode;
      }
    }
    return encodeURIComponent(str);
  }
  #attDecode(str: any, attName?: string) {
    if (!this.decode) {
      if (attName === "port") return str.toString();
      else return str;
    } else {
      if (attName === "hostname") return domainToUnicode(str);
      else return decodeURIComponent(str);
    }
  }

  /* 最小单元 */

  get protocol() {
    var protocol = this.#adsFragment.protocol;
    if (protocol) return this.#attDecode(protocol);
    else return "";
  }
  get username() {
    return this.#attDecode(this.#adsFragment.username);
  }
  get password() {
    return this.#attDecode(this.#adsFragment.password);
  }
  get hostname() {
    return this.#attDecode(this.#adsFragment.hostname, "hostname");
  }
  /* 不存在则为""
       如果decode=true,则为number,否则为string */
  get port() {
    return this.#attDecode(this.#adsFragment.port, "port");
  }
  get pathname() {
    return this.#attDecode(super.pathname);
  }
  //get search(){}
  /* 以'#'开头 */
  get hash() {
    let hash = this.#adsFragment.hash;
    return hash ? "#" + this.#attDecode(hash) : "";
  }

  /* ---set---- */

  set protocol(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");
    let atName = "protocol";
    this.#adsFragment.protocol = this.#attEncode(val, atName);
  }
  set username(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");
    let atName = "username";
    this.#adsFragment.username = this.#attEncode(val, atName);
  }
  set password(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");
    let atName = "password";
    this.#adsFragment.password = this.#attEncode(val, atName);
  }
  set hostname(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");
    let atName = "hostname";
    this.#adsFragment.hostname = this.#attEncode(val, atName);
  }
  /* 数字或字符串的(0~65535), ""表示没有端口(默认端口) , 其他值则抛出异常 */
  set port(val: number | string) {
    var fma = this.#adsFragment;
    if (val === "") fma.port = val;
    else if (typeof val === "string") val = parseInt(val);
    else if (val >= 0 && val <= 65535) fma.port = val;
    else throw err("参数必须在-1~65535范围内").shield();
  }
  set pathname(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");
    super.setPath(this.#attEncode(val, "pathname"), true);
  }
  //get serach() //父类
  /* 以'#'开头,没有'#'开头会自动加上 */
  set hash(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");
    if (val[0] === "#") val = val.slice(1);
    this.#adsFragment.hash = this.#attEncode(val, "hash");
  }

  /* 最小单元 */
  /* 非最小单元 */

  get origin() {
    var host = this.host,
      protocol = this.protocol;
    var origin = protocol;
    if (protocol) {
      origin += "://";
    }

    if (host) {
      let auth = this.auth;
      if (auth) auth += "@";
      origin += auth + host;
    } else origin += host;
    return origin;
  }
  get host() {
    let port = this.port;
    if (port) port = ":" + port;
    return this.hostname + port;
  }
  get auth() {
    let password = this.password;
    let username = this.username;
    if (password || username)
      return username + (password ? ":" + password : "");
    else return username;
  }
  get href() {
    return this.origin + this.pathname + this.search + this.hash;
  }

  set origin(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");
    let ps = matchURL(val);
    this.protocol = ps.protocol ?? "";
    this.hostname = ps.hostname ?? "";
    this.port = ps.port ?? "";
    this.username = ps.username ?? "";
    this.password = ps.password ?? "";
  }
  set host(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");
    var regExp = /^(?<hostname>[^:/]+)(:(?<port>\d+))?/;
    var re = val.match(regExp)?.groups;
    if (re) {
      this.hostname = re.hostname;
      this.port = re.port ?? "";
    }
  }
  set auth(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");

    var regExp = /^(?<username>[^:/]+)(:(?<password>\d+))?/;
    var re = val.match(regExp)?.groups;
    if (re) {
      this.username = re.username;
      this.password = re.password;
    }
  }
  set href(val: string) {
    if (typeof val !== "string") throw err.argType(val, "string");

    let ps = matchURL(val);
    //必须先设置hostname,再设置protocol,不然会影响到node模块的url类
    this.hostname = ps.hostname ?? "";
    this.protocol = ps.protocol ?? "";
    this.username = ps.username ?? "";
    this.password = ps.password ?? "";
    //必须先设置hostname,再设置prot,不然会影响到node模块的url类
    this.port = ps.port ?? "";
    this.pathname = ps.pathname ?? "";
    this.search = ps.search ?? "";
    this.hash = ps.hash ?? "";
  }

  toPath(isPOSIX: boolean = POSIX): Path {
    if (isPOSIX) return new Path(this.pathname, true);
    else {
      let pathname = this.pathname.slice(1);
      return new Path(pathname, false);
    }
  }
  toString() {
    return this.href;
  }
  toJSON() {
    return this.href;
  }
}
