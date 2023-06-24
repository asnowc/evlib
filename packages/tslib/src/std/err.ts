/**
 * 屏蔽错误栈
 *      参数类型错误(上级错误)
 * 携带错误信息并在抛出异常时输出
 *
 */

interface ErrStackInfo {
    /**调用栈信息  */
    info: string;
    /* 当前栈是否被屏蔽 */
    shielded: boolean;
}
interface errConsOps {
    name?: string;
    up?: number;
    slice?: number;
}
class CommonError extends Error {
    constructor(msg?: string, ops?: errConsOps) {
        super(msg);
        let stackStr = this.stack;
        Reflect.deleteProperty(this, "stack");

        let stackList = this.stackList;
        this.stack = stackStr;

        if (ops) {
            let { slice, name, up } = ops;
            if (slice && slice > 0) stackList.splice(0, slice);

            if (name) this.name = name;
            if (up && up > 0) {
                for (let i = 0; i < up && i < stackList.length; i++) {
                    stackList[i].shielded = true;
                }
            }
        }
    }
    binding?: any;
    /** 调用栈信息 */
    private readonly stackList: ErrStackInfo[] = [];
    get stack(): string {
        let msg = this.message;
        let name = this.name;
        let stack = "Error: " + (msg ?? "");

        let noBreak = true;
        for (const x of this.stackList) {
            let si = x.info;
            if (noBreak) {
                if (x.shielded) continue;
                else noBreak = false;
            }
            stack += "\n" + si;
        }
        return stack;
    }
    set stack(val: string) {
        if (typeof val !== "string") throw err.argType(val, "string");
        let c = val.split("\n");
        c.shift(); //去除前边的头部
        let newLength = c.length;
        let stackList = this.stackList;
        if (stackList.length > newLength) stackList.splice(newLength);
        for (let i = 0; i < newLength; i++) {
            let st: ErrStackInfo = {
                info: c[i],
                shielded: false,
            };
            stackList[i] = st;
        }
    }
    setBinding(val: any): this {
        //添加捆绑数据
        this.binding = val;
        return this;
    }

    /**
     * @description 屏蔽当前的调用者
     * @param  up 大于0。默认为1，向上屏蔽的层数。
     */
    shield(up: number = 1) {
        if (up > 0) {
            let index = this.getCallerIndex();
            if (!this.inShield(index, up)) console.warn("调用者不在该error的调用栈上");
        } else {
            throw err.arg(up, "参数不能小于1");
        }
        return this;
    }
    /** 如果返回false，表示屏蔽失败。说明在内部调用栈stackList上找不到索引 */
    private inShield(index: number, up: number): boolean {
        let stackInfos = this.stackList;
        if (up > 0 && index >= 0) {
            //屏蔽
            for (let max = index + up; index < max; index++) {
                let stInfo = stackInfos[index];
                stInfo.shielded = true;
            }
            return true;
        } else return false;
    }
    /**
     * @description 获取调用者索引，
     * @param shieldX 默认为1。内部调佣的栈的层数如 外部函数为ts, ts调用shield, shield调用getCallerIndex, 要获取ts在stackList中的索引，则需要屏蔽shield,则传入1，
     * @returns -1：表示不在err调用栈中
     */
    private getCallerIndex(shieldX: number = 1): number {
        /* 
             * 
             * 
             * 
           *   *    调用者位置
           *  * +   分支长度(内部调用)
           *    -

        */
        let list = callStackList(this.getCallerIndex);
        let stackInfos = this.stackList;

        /** 返回test和interior从尾部开始比较，连续相同的个数 */
        function testStack(inList: ErrStackInfo[], tsList: string[]): number {
            let x = inList.length - 1,
                y = tsList.length - 1;
            if (x < 0 || y < 0) return 0;
            let ops = inList.length;
            for (; x >= 0 && y >= 0; x--, y--) {
                let res = inList[x].info === tsList[y];
                if (!res) {
                    ops = inList.length - 1 - x;
                    break;
                }
            }
            return ops;
        }
        let pt = testStack(stackInfos, list) + 1;
        if (pt + shieldX === list.length) return stackInfos.length - pt;
        else return -1;
    }
}
Error.stackTraceLimit = Infinity;
/** 获取调用堆栈列表 */
export function callStackList(shieldFx: Function = callStackList): string[] {
    if (typeof shieldFx !== "function") throw "参数必须为function类型";
    let s: any = {};
    (Error as any).captureStackTrace(s, shieldFx);
    let str = <string>s.stack;
    let re = str.split("\n");
    re.shift();
    return re;
}
export function err(get?: any): CommonError {
    if (get instanceof CommonError) return get;
    else if (get instanceof Error) {
        let err = new CommonError(get.message, { slice: 1 });
        err.message = get.message ?? "";
        err.stack = get.stack ?? "";
        return err;
    } else {
        let msg = get;
        return new CommonError(msg, { slice: 1 });
    }
}

/**
 * @description 生成一个上级错误的error
 * @param  errorArgs 参数列表
 * @param {string|Function|[string|Function]} correctType 正确类型
 *      - string: 表示正确类型为一个基础类型
 *      - Function: 表示正确类型为一个类的实例
 * @param  index 列表的那个参数错误
 */
err.argType = function argTypeError(errorArgs: any, correctTypeDesc: ArgDesc, index: number = 0): CommonError {
    if (index >= 0) {
        let msg = "参数 " + (index + 1) + " 存在问题：";
        try {
            msg += this.msg_type(errorArgs, correctTypeDesc);
        } catch (error: any) {
            throw err(error).shield();
        }
        let error = new CommonError(msg, { name: "函数参数类型错误", slice: 1, up: 1 });
        error.binding = errorArgs;
        return error;
    } else throw err.arg(index, "该参数不能小于0", 2);
};
err.arg = function arg(arg: any, msg: string, index: number = 0): CommonError {
    //参数的对象错误
    if (typeof msg !== "string") throw err.argType(msg, "string", 2);
    if (index >= 0) {
        var message = "参数 " + (index + 1) + " 存在问题：" + msg;
        var re = new CommonError(message, { name: "函数参数错误", up: 1, slice: 1 });
        re.binding = arg;
        return re;
    } else throw err.arg(index, "该参数不能小于0", 2);
};

/**
 * @param correctType string 自定义类型描述; Function: 类名作为描述 Array: 联合类型
 */
function getType(errorArg: any, correctArgType: ArgDesc): string {
    let correctType: string, argType: string;

    //生成正确类型字符串
    if (typeof correctArgType === "function") correctType = correctArgType.name;
    else if (typeof correctArgType === "string") correctType = correctArgType;
    else if (Array.isArray(correctArgType)) {
        correctType = "";
        for (let i = 0; i < correctArgType.length; i++) {
            const argItem = correctArgType[i];
            switch (typeof argItem) {
                case "function":
                    correctType += "|" + argItem.name;
                    break;
                case "string":
                    correctType += argItem;
                    break;
                default:
                    throw err.inArgType(argItem, "string | Function", 2, i);
            }
        }
        correctType = correctType.slice(1);
    } else throw err.argType(correctArgType, "string | array | Class", 2);

    //获取目标类型
    if (typeof errorArg === "object") {
        if (errorArg === null) argType = "null";
        else {
            let oName = Reflect.getPrototypeOf(errorArg)?.constructor?.name;
            if (oName) argType = "obj-" + oName;
            else argType = "object";
        }
    } else argType = typeof errorArg;
    //基本类型：number,string,object,symbol,function,undefined,boolean,bigInt
    let msg = "应为<" + correctType + ">类型，当前传入:<" + argType + ">类型";
    return msg;
}
err.msg_type = getType;
err.inArg = function inArgError(arg: any, arg3: string, index1: number, index2: number | string) {
    //array:某个位置类型错误
    //object:某个键值类型错误

    if (index1 >= 0) {
        if (typeof index2 === "number") {
            if (index2 < 0) throw err.arg(index2, "参数不能小于0", 3);
        } else if (typeof index2 !== "string") throw err.argType(index2, "number|string", 3);
        var msg = "参数 " + (index1 + 1) + " 存在问题--";
        try {
            msg += "arg[" + index2 + "]:" + arg3;
        } catch (error: any) {
            throw err(error).shield();
        }
        var re = new CommonError(msg, { name: "参数内类型错误", slice: 1, up: 1 });
        re.binding = arg[index2];
        return re;
    } else throw err.arg(index1, "参数不能小于0", 2);
};

function inArgTypeError(errorArg: any, argDesc: new () => any, index1: number, index2: string): CommonError;
function inArgTypeError(errorArg: any, argDesc: any[], index1: number, index2: number): CommonError;
function inArgTypeError(errorArg: any, argDesc: string, index1: number, index2: number | string): CommonError;
function inArgTypeError(errorArg: any, argDesc: ArgDesc, index1: number, index2: number | string): CommonError;
/**
 *
 */
function inArgTypeError(errorArg: any, argDesc: ArgDesc, index1: number, index2: number | string) {
    //array:某个位置类型错误
    //object:某个键值类型错误

    if (index1 >= 1) {
        if (typeof index2 === "number") {
            if (index2 < 0) throw err.arg(index2, "参数不能小于0", 3);
        } else if (typeof index2 !== "string") throw err.argType(index2, "number|string", 3);
        let msg = "参数 " + (index1 + 1) + " 存在问题：";
        try {
            msg += "arg[" + index2 + "]" + getType(errorArg, argDesc);
        } catch (error: any) {
            throw err(error).shield();
        }
        let error = new CommonError(msg, { name: "参数内类型错误", slice: 1, up: 1 });
        error.binding = errorArg;
        return error;
    } else throw err.arg(index1, "参数不能小于1", 3);
}
err.inArgType = inArgTypeError;

err.argTest = function argTest() {};
type ArgDesc = string | (new () => any) | any[];
// process.on("uncaughtException", err);
// process.on("unhandledRejection", err);
// window.addEventListener("error", err, true);
