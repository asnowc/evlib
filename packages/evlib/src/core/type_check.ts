import { TypeError, ParametersError } from "../errors.js";
const createErrDesc = TypeError.createErrDesc;
/**
 * 如果 对象的字段预期类型为可选, 并且实际存在字段为undefined, 则在deleteSurplus为true是将字段删除
 */
function checkObject(doc: Record<string, any>, except: ExceptTypeMap, options: CheckOptions): CheckRes {
    const error: Record<string, TypeErrorDesc> = {};
    const { checkAll } = options;
    const deleteSurplus = options.redundantFieldPolicy === "delete";
    const checkProvidedOnly = options.redundantFieldPolicy == "pass";

    let isErr = false;

    let keys = deleteSurplus || !checkProvidedOnly ? new Set(Object.keys(doc)) : undefined;

    for (let [testKey, exceptType] of Object.entries(except)) {
        let exist = Object.hasOwn(doc, testKey);
        if (exceptType instanceof OptionalKey) {
            if (!exist) continue;
            else if (doc[testKey] === undefined && deleteSurplus) {
                delete doc[testKey];
                continue;
            }
            exceptType = exceptType.type;
        } else if (!exist) {
            error[testKey] = createErrDesc("存在", "不存在");
            if (!checkAll) return { error, value: doc };
            continue;
        }

        const res = checkType(doc[testKey], exceptType, options);
        if (res.error) {
            error[testKey] = res.error;
            if (!checkAll) return { error, value: doc };
            else isErr = true;
        }
        keys?.delete(testKey);
    }
    if (keys?.size) {
        if (deleteSurplus) for (const key of keys) delete doc[key];
        else if (!checkProvidedOnly) {
            for (const key of keys) error[key] = createErrDesc("不存在", "存在");
            isErr = true;
        }
    }
    if (isErr) return { error, value: doc };
    return { value: doc };
}
function checkTuple<T = unknown>(arr: any[], except: ExceptType[], options: CheckOptions): CheckRes<T[]> {
    const error: Record<string, TypeErrorDesc> = {};
    const { checkAll } = options;
    const deleteSurplus = options.redundantFieldPolicy === "delete";
    const checkProvidedOnly = options.redundantFieldPolicy == "pass";

    let isErr = false;
    if (Array.isArray(arr)) {
        let maxLen = except.length;

        if (arr.length != except.length) {
            if (arr.length > except.length && deleteSurplus) arr.length = except.length;
            else if (arr.length > except.length && checkProvidedOnly) {
            } else {
                if (arr.length < except.length) maxLen = except.length;
                error.length = `预期长度: ${except.length}, 实际: ${arr.length}`;
                if (!checkAll) return { error, value: arr };
            }
        }
        for (let i = 0; i < maxLen; i++) {
            let exceptType = except[i];
            let actualType = arr[i];
            const res = checkType(actualType, exceptType, options);
            if (res.error) {
                error[i] = res.error;
                if (!checkAll) return { error, value: arr };
                else isErr = true;
            }
        }
    } else return { error: createErrDesc("Array", getClassType(arr)), value: arr };

    if (isErr) return { error, value: arr };
    else return { value: arr };
}

/** @public */
export function checkType<T = unknown>(value: any, except: ExceptType, options?: CheckOptions): CheckRes<T>;
export function checkType(value: any, except: ExceptType, opts: CheckOptions = {}): CheckRes<unknown> {
    if (except === null) throw new ParametersError(2, createErrDesc("ExceptType", typeof except), "exceptType");

    switch (typeof except) {
        case "string":
            let actualType = getBasicType(value);
            if (actualType !== except) return { error: createErrDesc(except, actualType), value };
            break;
        case "function": {
            if (except.baseType && typeof value !== except.baseType)
                return { error: createErrDesc(except.baseType, typeof value), value };
            const res = except(value, opts) ?? { value };
            if (!Object.hasOwn(res, "value")) res.value = value;
            return res as CheckRes;
        }
        case "object":
            if (Array.isArray(except)) return checkTuple(value, except, opts);
            else if (getBasicType(value) === "object")
                return checkObject(value, except as ExceptTypeMap, opts) ?? { value };
            else return { error: createErrDesc("object", getBasicType(value)), value };

        default:
            throw new ParametersError(2, createErrDesc("ExceptType", typeof except), "exceptType");
    }
    return { value };
}

/**
 * @public
 * @remark 在typeof之上区分null
 */
export function getBasicType(val: any): BasicType {
    return val === null ? "null" : typeof val;
}
/**
 * @remark 获取对象的类名, 如果val为基础类型, 则返回基础类型
 * @public
 */
export function getClassType(val: any) {
    let basicType = getBasicType(val);
    if (basicType === "object") {
        let type: string = val.constructor?.name ?? "Object";
        return type;
    } else return basicType;
}

class OptionalKey {
    constructor(public readonly type: ExceptType) {}
}
/** @public */
export interface CheckOptions {
    /**
     * @remark 对于对象和元组类型, 如果对象或元组中存在预期类型中不存在的字段, 应该执行的策略
     *   "pass": 检测通过
     *   "error": 检测不通过
     *   "delete": 检测通过, 并删除多余字段
     * @defaultValue "error"
     */
    redundantFieldPolicy?: "pass" | "delete" | "error";

    /**
     * @remark 为true检测所有预期类型, 为false时返回第一检测不通过的结果
     * @defaultValue false
     */
    checkAll?: boolean;
    /**
     * @remark 如果设置为true, 对于数组类型和对象类型, 将会进行拷贝
     */
    // new?: boolean;
}
/** @public */
export interface CheckFn {
    (val: any, option: Readonly<CheckOptions>): Partial<CheckRes> | undefined;
    /** @remark 前置类型, 前置类型匹配才会执行检测函数, 如果不匹配, 检测直接不通过 */
    baseType?: BasicType;
}

/**
 * @public
 * @remark 生成可选类型检测函数
 */
export function optional(type: ExceptType) {
    return new OptionalKey(type);
}

optional.number = new OptionalKey("number");
optional.string = new OptionalKey("string");

/**
 * @public
 * @remark 预定义的检测函数工厂
 */
export const checkFnFactor = {
    /** @remark 生成数字范围检测函数 */
    numberRange(min: number, max = Infinity): CheckFn {
        const checkFn: CheckFn = function checkFn(val: number, option) {
            if (val > max || val < min) {
                return { error: createErrDesc(`[${min},${max}]`, val.toString()) };
            }
        };
        checkFn.baseType = "number";
        return checkFn;
    },
    /** @remark 生成实例类型检测函数 */
    instanceof(obj: Function): CheckFn {
        if (typeof obj !== "function") throw new Error();
        const checkFn: CheckFn = function checkFn(val: object) {
            if (val instanceof obj) return;
            return { error: createErrDesc(obj.name, getClassType(val)) };
        };
        checkFn.baseType = "object";
        return checkFn;
    },
    /** @remark 生成联合类型检测函数 */
    unionType(types: ExceptType[]): CheckFn {
        const checkFn: CheckFn = function testFx(val: any, option) {
            let errors: TypeErrorDesc[] = [];
            for (const except of types) {
                const error = checkType(val, except, option)?.error;
                if (error === undefined) return;
                errors.push(error);
            }
            return { error: errors.join(" | ") };
        };
        return checkFn;
    },
    /** @remark 生成数组类型检测函数 */
    arrayType(type: ExceptType, length?: number): CheckFn {
        const checkFn: CheckFn = function checkFn(val: any, options) {
            const { checkAll } = options;
            const deleteSurplus = options.redundantFieldPolicy === "delete";
            if (Array.isArray(val)) {
                let errCount = 0;
                let errors: any = {};
                if (length !== undefined && length !== val.length) {
                    if (deleteSurplus) val.length = length;
                    else {
                        errors.length = `预期长度: ${length}, 实际: ${val.length}`;
                        errCount++;
                        if (!checkAll) return { error: errors };
                    }
                }
                for (let i = 0; i < val.length; i++) {
                    let item = val[i];
                    let res = checkType(item, type);
                    if (res.error) {
                        errors[i] = res.error;
                        if (!checkAll) return { error: errors };
                        errCount++;
                    }
                }
                if (errCount) return { error: errors };
            } else return { error: createErrDesc("Array", getClassType(val)) };
        };
        checkFn.baseType = "object";
        return checkFn;
    },
};

type BasicType = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function" | "null";
/** @remark 元组项检测 */
type ExceptTypeTuple = ExceptType[];
/**
 * @remark 对象属性检测
 * @public
 */
export type ExceptTypeMap = { [key: string | number]: ExceptType };
/**
 * @public
 * @remark 类型检测
 * string: BasicType 基础类型检测
 * function: 自定义检测函数
 * true: 检测通过, 可以用于 any类型
 */
export type ExceptType = CheckFn | OptionalKey | BasicType | ExceptTypeMap | ExceptTypeTuple | boolean;

type TypeErrorDesc = string | { [key: string]: TypeErrorDesc };
interface CheckRes<T = unknown> {
    error?: TypeErrorDesc;
    /** 要替换的值 */
    value: T;
}

/**
 * 类型转换
 *
 * 上下文:
 *
 *
 * ExceptType:
 *   string: 基础检测
 *   array: 深度匹配元组  多余判定
 *   object: 深度匹配对象 多余判定
 *
 * checkFn:
 *   联合类型
 *   数组类型
 *   任意类型
 *   对象类型
 *   数字范围
 *
 */
