/**
 * 如果 对象的字段预期类型为可选, 并且实际存在字段为undefined, 则在deleteSurplus为true是将字段删除
 */
function checkObject(doc: Record<string, any>, except: ExceptTypeMap, options?: CheckTypeOption) {
    let errors: Record<string, any> = {};
    let checkAll = options?.checkAll;
    let deleteSurplus = options?.deleteSurplus;
    let checkProvidedOnly = !deleteSurplus && options?.checkProvidedOnly;

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
            errors[testKey] = createErrDesc("存在", "不存在");
            if (!checkAll) return errors;
            continue;
        }

        let res = checkType(doc[testKey], exceptType, options);
        if (res) {
            errors[testKey] = res;
            if (!checkAll) return errors;
        }
        keys?.delete(testKey);
    }
    if (keys?.size) {
        if (deleteSurplus) for (const key of keys) delete doc[key];
        else if (!checkProvidedOnly) {
            for (const key of keys) errors[key] = createErrDesc("不存在", "存在");
        }
    }
    if (Object.keys(errors).length) return errors;
}
function checkTuple(arr: any[], except: ExceptType[], options?: CheckTypeOption) {
    let errors: Record<any, any> = {};
    let checkAll = options?.checkAll;
    let deleteSurplus = options?.deleteSurplus;
    let checkProvidedOnly = !deleteSurplus && options?.checkProvidedOnly;

    if (Array.isArray(arr)) {
        let maxLen = except.length;
        if (arr.length != except.length) {
            if (arr.length > except.length && deleteSurplus) arr.length = except.length;
            else if (arr.length > except.length && checkProvidedOnly) {
            } else {
                if (arr.length < except.length) maxLen = except.length;
                errors.length = `预期长度: ${except.length}, 实际: ${arr.length}`;
                if (!checkAll) return errors;
            }
        }
        for (let i = 0; i < maxLen; i++) {
            let exceptType = except[i];
            let actualType = arr[i];
            let res = checkType(actualType, exceptType, options);
            if (res) {
                errors[i] = res;
                if (!checkAll) return errors;
            }
        }
    } else errors.push(createErrDesc("Array", getClassType(arr)));

    if (errors.length) return errors;
}

interface CheckTypeOption {
    /** 当为true时, 如果元组或对象中的key不存在 ExceptType 中, 则将其字段删除. */
    deleteSurplus?: boolean;
    /** 仅匹配提供的预期字段, 默认为 false . 如果对象或元组中存在预期类型中不存在的字段, 当 checkProvidedOnly 为true时, 检测通过, 否则不通过. 当deleteSurplus为true时无效  */
    checkProvidedOnly?: boolean;
    /** 为true检测所有预期类型, 为false时返回第一检测不通过的结果 */
    checkAll?: boolean;
}

/**
 * @deprecated
 */
export function checkType(val: any, exceptType: ExceptType, options?: CheckTypeOption): undefined | string | any {
    switch (typeof exceptType) {
        case "string":
            let actualType = getBasicType(val);
            if (actualType !== exceptType) return createErrDesc(exceptType, actualType);
            break;
        case "function":
            if (exceptType.type && typeof val !== exceptType.type) return createErrDesc(exceptType.type, typeof val);
            return exceptType(val);
        case "object":
            if (exceptType === null) throw new Error("预期类型错误");
            else if (Array.isArray(exceptType)) return checkTuple(val, exceptType, options);
            else if (getBasicType(val) === "object") return checkObject(val, exceptType as ExceptTypeMap, options);
            else return createErrDesc("object", getBasicType(val));

        default:
            throw new Error("传入参数2类型错误");
    }
}

export function validate<Val = unknown>(
    value: any,
    exceptType: ExceptType,
    options?: CheckTypeOption
): { error?: any; value: Val } {
    switch (typeof exceptType) {
        case "string":
            let actualType = getBasicType(value);
            if (actualType !== exceptType) return { error: createErrDesc(exceptType, actualType), value };
            break;
        case "function":
            if (exceptType.type && typeof value !== exceptType.type)
                return { error: createErrDesc(exceptType.type, typeof value), value };
            return exceptType(value);
        case "object":
            if (exceptType === null) throw new Error("预期类型错误");
            else if (Array.isArray(exceptType)) return { error: checkTuple(value, exceptType, options), value };
            else if (getBasicType(value) === "object")
                return { error: checkObject(value, exceptType as ExceptTypeMap, options), value };
            else return { error: createErrDesc("object", getBasicType(value)), value };

        default:
            throw new Error("传入参数2类型错误");
    }
    return { value };
}
function transformFx() {}

/** 在typeof之上区分null */
export function getBasicType(val: any): VabBasicType {
    return val === null ? "null" : typeof val;
}
export function getClassType(val: any) {
    let basicType = getBasicType(val);
    if (basicType === "object") {
        let type: string = val.__proto__?.constructor?.name ?? "Object";
        return type;
    } else return basicType;
}
export function createErrDesc(exceptType: string, actualType: string) {
    return "预期类型:" + exceptType + ", 实际:" + actualType;
}

class OptionalKey {
    constructor(public readonly type: ExceptType) {}
}

export function optional(type: ExceptType) {
    return new OptionalKey(type);
}

optional.number = new OptionalKey("number");
optional.string = new OptionalKey("string");

export interface CheckFx {
    (val: any): any;
    type?: string;
}
export const checkFx = {
    numScope(min: number, max = Infinity): CheckFx {
        function testFx(val: any) {
            if (val > max || val < min) return `超过范围:[${min},${max}], 值为:${val}`;
        }
        testFx.type = "number";
        return testFx;
    },
    instanceof(obj: Function): CheckFx {
        function testFx(val: any) {
            if (val === null || !(val instanceof obj)) {
                return createErrDesc(obj.name, val === null ? "null" : val.constructor.name);
            }
        }
        testFx.type = "object";
        return testFx;
    },
    unionType(types: ExceptType[]): CheckFx {
        function testFx(val: any) {
            let errors: string[] = [];
            for (const type of types) {
                let res = checkType(val, type);
                if (res === undefined) return;
                errors.push(res);
            }
            return errors;
        }
        return testFx;
    },
    arrayType(type: ExceptType, length?: number, deleteSurplus = true): CheckFx {
        function testFx(val: any) {
            if (Array.isArray(val)) {
                let errCount = 0;
                let errors: any = {};
                if (length !== undefined && length !== val.length) {
                    if (deleteSurplus) val.length = length;
                    else {
                        errors.length = `预期长度: ${length}, 实际: ${val.length}`;
                        errCount++;
                    }
                }
                for (let i = 0; i < val.length; i++) {
                    let item = val[i];
                    let res = checkType(item, type);
                    if (res) {
                        errors[i] = res;
                        errCount++;
                    }
                }
                if (errCount) return errors;
            } else return createErrDesc("Array", getClassType(val));
        }
        testFx.type = "object";
        return testFx;
    },
    any(): CheckFx {
        return function testFx() {};
    },
};
/** @deprecated */
export const testFx = checkFx;
export type ExceptTypeMap = { [key: string | number]: ExceptType };
export type ExceptType = CheckFx | OptionalKey | VabBasicType | ExceptTypeMap | ExceptType[];
type VabBasicType =
    | "string"
    | "number"
    | "bigint"
    | "boolean"
    | "symbol"
    | "undefined"
    | "object"
    | "function"
    | "null";
