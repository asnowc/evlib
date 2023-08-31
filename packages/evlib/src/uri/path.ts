import { err } from "../tool/err.js";
let POSIX = true;
export function getPOSIXDefault() {
    return POSIX;
}
export function setPOSIXDefault(isPOSIX: boolean) {
    POSIX = isPOSIX;
}
/* 

文件名不能包含:
    windows: \/:*?"<>|    (ASCII 0~32)
    linux: /    (ASCII 0)

*/
type ads_adsT = {
    list: string[];
    root: string;
    up: number;
    sep: string;
};
export function parsePath(path: string, isPOSIX: boolean) {
    let root = "",
        up = 0,
        list: string[] = [];
    let nnList = path.split(isPOSIX ? /\// : /\\+|\/+/);

    var first = nnList[0];
    if (first === ".") {
        nnList.shift();
    } else if (first && !isPOSIX && first[first.length - 1] === ":") root = <string>nnList.shift();
    else if (first === "") {
        nnList.shift();
        if (isPOSIX) root = "/";
    }
    if (nnList[nnList.length - 1] === "") nnList.pop();
    for (const it of nnList) {
        if (it === "..") {
            if (list.length > 0) list.pop();
            else if (root) throw err("路径异常: '..'返回超出根目录").shield();
            else up++;
        } else list.push(it);
    }
    return { root, up, list };
}
/**
 * @ovaerload (pt?:string)   //默认为""。 指定路径的path
 * @ovaerload (isPOSIX:boolean) //windows下默认为false,linux下默认为true。 指定类型的path
 * @ovaerload (pt:string, isPOSIX)  //指定路径,指定系统的path
 */
export class Path {
    constructor(pt: string);
    constructor(pt: string, usePOSIX: boolean);
    constructor(pt: string = "", usePOSIX: boolean = POSIX) {
        if (typeof pt === "string") this.setPath(pt, usePOSIX);
        else throw err.argType(pt, "string");
    }
    /* 路径解析路径 */
    #parseStr = parsePath;
    /* 连接两个路径数据到另一个路径数据 */
    #connectList(
        adsTL: { list: string[]; up: number; root: string },
        adsTR: { list: string[]; up: number },
        setAts: ads_adsT
    ) {
        setAts.root = adsTL.root;
        //连接两个路径，返回新的路径列表
        let L_up = adsTL.up,
            R_up = adsTR.up,
            L_list = adsTL.list,
            R_list = adsTR.list;
        //连接两个路径列表，返回新的路径列表
        if (R_up === 0) {
            //目标地址没有向上级目录转跳
            setAts.up = L_up;
            setAts.list = L_list.concat(R_list);
        } else {
            // xx + ../xx  ../xx + ../xx   ../../ + ../xx

            //添加的目录
            var k = L_list.length - R_up;
            if (k < 0) {
                setAts.list = [...R_list];
                setAts.up = -k;
            } else {
                setAts.list = L_list.slice(0, k).concat(R_list);
                setAts.up = L_up;
            }
        }
    }
    /* 路径内部数据 */
    #pathOps: ads_adsT = {
        list: <string[]>[],
        root: "", //linx为"/" windows为"x:"
        up: 0,
        sep: "",
    };
    /** 获取地址内部数据 */
    getIntnAdsT(): ads_adsT {
        let adsT = this.#pathOps;
        let re = { ...adsT };
        re.list = [...adsT.list];
        return re;
    }
    /**设置内部数据. 如果路径列表中含有'/'或'\'字符,输出的路径与Path会不相符 */
    setIntnAdsT(val: Partial<ads_adsT>) {
        var adsT = this.#pathOps;
        try {
            if (val.root) this.root = val.root;
        } catch (error) {
            throw err(error).shield();
        }
        let up: any = val.up;
        if (up >= 0) adsT.up = <number>val.up;
        if (val.sep) adsT.sep = val.sep;

        if (Array.isArray(val.list)) adsT.list = [...val.list];
    }
    /** 只读. 路径是否为绝对地址 */
    get isAbsolute() {
        return this.#pathOps.root !== "";
    }
    #toStr(list: string[], sep: string, head?: string | number) {
        if (typeof head === "number") {
            //相对路径
            let up = head;
            if (up > 0) head = sep + "..".repeat(up).slice(1);
            else head = ".";
        } else if (head === undefined) head = ".";
        let href = head; //此时href的可能:  "." ".." "C:" "/"

        if (list.length === 0) return href;
        if (href.endsWith(sep)) href + list.join(sep);
        return href + sep + list.join(sep);
    }
    /** 全路径, 设置时,将用系统默认分隔符解析 */
    get pathname() {
        let { list, root, up } = this.#pathOps;
        return this.#toStr(list, this.sep, root ? root : up);
    }
    get root() {
        return this.#pathOps.root;
    }
    /**  路径最后的名字(包括扩展名) */
    get basename() {
        let list = this.#pathOps.list;
        let name = list[list.length - 1];
        return name ?? "";
    }
    /** 只读.  */
    get dirname() {
        let { list, root, up } = this.#pathOps;
        if (list.length > 0) list = list.slice(list.length - 1);
        return this.#toStr(list, this.sep, root ? root : up);
    }
    /** 只读.  */
    get extname() {
        let name = this.name;
        let x = name.lastIndexOf(".");
        if (x === -1) return "";
        else return name.slice(x);
    }
    /** 只读.  */
    get name() {
        let name = this.basename;
        let x = name.lastIndexOf(".");
        if (x === -1) return name;
        else return name.slice(0, x);
    }
    /** 用于显示的分隔符 */
    get sep() {
        let sep = this.#pathOps.sep;
        return sep ? sep : POSIX ? "/" : "\\";
    }
    set pathname(val: string) {
        try {
            this.setPath(val);
        } catch (error) {
            throw err(error).shield();
        }
    }
    //设置根目录
    set root(val: string) {
        if (typeof val !== "string") throw err.argType(val, "string");
        let adsT = this.#pathOps;
        if (val === "/") adsT.root = val;
        else if (val.search(/[\\\/]/) >= 0) throw err("根目录不符合规范").shield();
        else adsT.root = val;
        adsT.up = 0;
    }
    set basename(val: string) {
        if (typeof val !== "string") throw err.argType(val, "string");
        let list = this.#pathOps.list;
        list[list.length - 1] = val;
    }
    /** 获取分隔符,可自定义,只影响输出 windows下默认为'\' 其他为"/".  当设置为""时,恢复默认 */
    set sep(val: string) {
        if (typeof val !== "string") throw err.argType(val, "string");
        this.#pathOps.sep = val;
    }
    /**
     * @description 设置路径
     * @param {string} val 路径
     * @param {usePOSXI} usePOSXI windows下默认为false,其他为true
     * @return {this}
     */
    setPath(val: string, usePOSXI: boolean = POSIX) {
        if (typeof val !== "string") throw err.argType(val, "string");
        Object.assign(this.#pathOps, this.#parseStr(val, usePOSXI));
        return this;
    }
    /** 复制出相同的path对象 */
    copy(): Path {
        var Super = Path;
        var newAds = new Super("");
        newAds.setIntnAdsT(this.getIntnAdsT());
        return newAds;
    }
    /**
     * @description 向地址前添加路径或path 如果当前为绝对路径，则头部会被替换成传入路径的头部
     * @param {Path|string} pt 要在前端添加的路径或地址
     * @param {usePOSXI} usePOSXI windows下默认为false,其他为true
     * @return {this}
     */
    unshift(pt: string): this;
    unshift(pt: string, usePOSXI: boolean): this;
    unshift(pt: Path): this;
    unshift(pt: string | Path, usePOSXI = POSIX) {
        var Super = <typeof Path>this.constructor;
        let adsT = this.#pathOps;
        let dstAdsT: { list: string[]; up: number; root: string };

        if (typeof pt === "string") dstAdsT = this.#parseStr(pt, usePOSXI);
        else if (pt instanceof Super) dstAdsT = pt.getIntnAdsT();
        else throw err.argType(pt, ["string", Super]);
        this.#connectList(dstAdsT, adsT, adsT);
        return this;
    }
    /**
     * @description 向地址尾部添加路径或path 如果当前为绝对路径，则头部会被替换成传入路径的头部
     * @param {Path|string} pt 要在前端添加的路径或地址
     * @param {usePOSXI} usePOSXI windows下默认为false,其他为true
     * @return {this}
     */
    push(pt: string): this;
    push(pt: string, usePOSXI: boolean): this;
    push(pt: Path): this;
    push(pt: string | Path, usePOSXI = POSIX) {
        var Super = <typeof Path>this.constructor;
        let adsT = this.#pathOps;
        let dstAdsT: { list: string[]; up: number; root: string };

        if (typeof pt === "string") dstAdsT = this.#parseStr(pt, usePOSXI);
        else if (pt instanceof Super) dstAdsT = pt.getIntnAdsT();
        else throw err.argType(pt, ["string", Super]);
        this.#connectList(adsT, dstAdsT, adsT);
        return this;
    }
    /**
     * @description 向上级目录跳转
     * @param {number} x 跳转的层数
     * @return {this}
     */
    pop(x: number = 1) {
        if (x <= 0) throw err.arg(x, "参数必须大于0");
        let adsT = this.#pathOps,
            list = adsT.list;
        var k = list.length - x;

        if (k >= 0) list.splice(k);
        else if (this.isAbsolute) adsT.list = [];
        else {
            adsT.up = k * -1;
            list.splice(0);
        }
        return this;
    }
    /** 从address去到to的相对路径 */
    relative(to: Path | string, usePOSXI = POSIX): Path {
        var Super = <typeof Path>this.constructor;
        let parseStr = this.#parseStr;
        let adsT = this.#pathOps,
            dstAdsT: ReturnType<typeof parseStr>;
        if (typeof to === "string") {
            let cc = this.#parseStr(to, usePOSXI);
            dstAdsT = cc;
        } else if (to instanceof Super) dstAdsT = to.getIntnAdsT();
        else throw err.argType(to, [Super, "string"]);

        /** 返回test和interior从头部开始比较，连续相同的个数 */
        function testList(A: string[], B: string[]): number {
            let x = A.length - 1,
                y = B.length - 1;
            if (x < 0 || y < 0) return 0;
            var ops = 0;
            for (let i = 0, j = 0; i <= x && j <= y; i++, j++) {
                if (A[i] === B[j]) ops = 1;
                else break;
            }
            return ops;
        }
        //绝对到相对=>dst
        //绝对到绝对=>ex
        //相对到绝对=>dst
        //相对到相对=>ex

        let newAds = new Super("");
        let list = adsT.list,
            dstList = dstAdsT.list;
        if (adsT.root) {
            if (dstAdsT.root === adsT.root) {
                //绝对到绝对
                let x = testList(list, dstList);
                let up = list.length - x;
                let newList = dstList.slice(x);
                newAds.setIntnAdsT({ up, list: newList });
            } else newAds.setIntnAdsT(dstAdsT); //绝对到相对或者是两个根目录不一样的绝对路径
        } else {
            //相对到绝对
            if (dstAdsT.root) newAds.setIntnAdsT(dstAdsT);
            else {
                //相对到相对
                if (adsT.up === dstAdsT.up) {
                    let x = testList(list, dstList);
                    let up = list.length - x + adsT.up;
                    let newList = dstList.slice(x);
                    newAds.setIntnAdsT({ up, list: newList });
                } else newAds.setIntnAdsT(dstAdsT);
            }
        }
        return newAds;
    }

    toString() {
        return this.pathname;
    }
    toJSON() {
        return this.pathname;
    }
}
export default Path;
