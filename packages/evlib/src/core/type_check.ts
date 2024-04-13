import { ParameterError, createTypeErrorDesc } from "../errors.js";
/**
 * 如果 对象的字段预期类型为可选, 并且实际存在字段为undefined, 则在deleteSurplus为true是将字段删除
 */
function checkObject(
  doc: Record<string, any>,
  except: ExceptTypeMap,
  options: TypeCheckOptions,
): CheckRes {
  const error: Record<string, TypeErrorDesc> = {};
  const { checkAll } = options;
  const deleteSurplus = options.policy === "delete";
  const checkProvidedOnly = options.policy == "pass";

  let isErr = false;

  let keys =
    deleteSurplus || !checkProvidedOnly ? new Set(Object.keys(doc)) : undefined;

  let exist: boolean;
  for (let [testKey, exceptType] of Object.entries(except)) {
    exist = Object.hasOwn(doc, testKey);

    if (
      exceptType instanceof InternalExceptType &&
      exceptType.checkType === "optional"
    ) {
      if (!exist) continue;
      else if (doc[testKey] === undefined && deleteSurplus) {
        delete doc[testKey];
        continue;
      }
      exceptType = exceptType.type;
    } else if (!exist) {
      error[testKey] = createTypeErrorDesc("存在", "不存在");
      if (!checkAll) return { error, value: doc };
      continue;
    }

    const res = internalCheckType(doc[testKey], exceptType, options);
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
      for (const key of keys)
        error[key] = createTypeErrorDesc("不存在", "存在");
      isErr = true;
    }
  }
  if (isErr) return { error, value: doc };
  return { value: doc };
}
function checkTuple<T = unknown>(
  arr: any[],
  except: ExceptType[],
  options: TypeCheckOptions,
): CheckRes<T[]> {
  const error: Record<string, TypeErrorDesc> = {};
  const { checkAll } = options;
  const deleteSurplus = options.policy === "delete";
  const checkProvidedOnly = options.policy == "pass";

  let isErr = false;
  if (Array.isArray(arr)) {
    let maxLen = except.length;

    if (arr.length != except.length) {
      if (arr.length > except.length && deleteSurplus)
        arr.length = except.length;
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
      const res = internalCheckType(actualType, exceptType, options);
      if (res.error) {
        error[i] = res.error;
        if (!checkAll) return { error, value: arr };
        else isErr = true;
      }
    }
  } else
    return {
      error: createTypeErrorDesc("Array", getClassType(arr)),
      value: arr,
    };

  if (isErr) return { error, value: arr };
  else return { value: arr };
}
function checkArray(
  val: any[],
  type: ExceptType,
  checkAll?: boolean,
): Partial<CheckRes> | undefined {
  let errCount = 0;
  let errors: any = {};

  for (let i = 0; i < val.length; i++) {
    let item = val[i];
    let res = internalCheckType(item, type);
    if (res.error) {
      errors[i] = res.error;
      errCount++;
      if (!checkAll) return { error: errors };
    }
  }
  if (errCount) return { error: errors };
}
function checkRecord(
  val: Record<string, any>,
  type: ExceptType,
  checkAll?: boolean,
): Partial<CheckRes> | undefined {
  let errCount = 0;
  let errors: any = {};
  const list = Object.keys(val);
  let key: string;
  for (let i = 0; i < list.length; i++) {
    key = list[i];
    let res = internalCheckType(val[key], type);
    if (res.error) {
      errors[key] = res.error;
      errCount++;
      if (!checkAll) return { error: errors };
    }
  }
  if (errCount) return { error: errors };
}

/** @public */
export function checkType<T extends ExceptType>(
  value: any,
  except: T,
  options?: TypeCheckOptions,
): CheckRes<InferExcept<T>>;
export function checkType(
  value: any,
  expect: ExceptType,
  opts: TypeCheckOptions = {},
): CheckRes<unknown> {
  if (expect === null)
    throw new ParameterError(
      2,
      createTypeErrorDesc("ExceptType", typeof expect),
      "exceptType",
    );
  return internalCheckType(value, expect, {
    checkAll: opts.checkAll,
    policy: opts.policy,
  });
}

function internalCheckType<T extends ExceptType>(
  value: any,
  except: T,
  options?: TypeCheckOptions,
): CheckRes<InferExcept<T>>;
function internalCheckType(
  value: any,
  expect: ExceptType,
  opts: TypeCheckOptions = {},
): CheckRes<unknown> {
  switch (typeof expect) {
    case "string":
      let actualType = getBasicType(value);
      if (actualType !== expect)
        return { error: createTypeErrorDesc(expect, actualType), value };
      break;
    case "function": {
      if (expect.baseType && typeof value !== expect.baseType)
        return {
          error: createTypeErrorDesc(expect.baseType, typeof value),
          value,
        };
      const res = expect(value, opts) ?? { value };
      if (!Object.hasOwn(res, "value")) res.value = value;
      return res as CheckRes;
    }
    case "object": {
      if (expect !== null) {
        if (expect instanceof Array) return checkTuple(value, expect, opts);
        else if (expect instanceof InternalExceptType) {
          return { value, error: expect.check(value, opts)?.error };
        } else if (getBasicType(value) === "object")
          return checkObject(value, expect as ExceptTypeMap, opts) ?? { value };
        else
          return {
            error: createTypeErrorDesc("object", getBasicType(value)),
            value,
          };
      }
    }

    default:
      throw new ParameterError(
        2,
        createTypeErrorDesc("ExceptType", typeof expect),
        "exceptType",
      );
  }
  return { value };
}

/**
 * @public
 * @remarks 在typeof之上区分null
 */
export function getBasicType(val: any): BasicType {
  return val === null ? "null" : typeof val;
}
/**
 * @remarks 获取对象的类名, 如果val为基础类型, 则返回基础类型
 * @public
 */
export function getClassType(val: any) {
  let basicType = getBasicType(val);
  if (basicType === "object") {
    let type: string = val.constructor?.name ?? "Object";
    return type;
  } else return basicType;
}

class InternalExceptType<T = unknown> {
  constructor(
    public readonly type: ExceptType,
    readonly checkType: "optional" | "array" | "record",
  ) {}
  check(value: any, opts: TypeCheckOptions) {
    switch (this.checkType) {
      case "array":
        return checkArray(value, this.type, opts.checkAll);
      case "record":
        return checkRecord(value, this.type, opts.checkAll);
    }
  }
}

/** @public */
export interface TypeCheckOptions {
  /**
   * @remarks 对于对象和元组类型, 如果对象或元组中存在预期类型中不存在的字段, 应该执行的策略
   *   "pass": 检测通过
   *   "error": 检测不通过
   *   "delete": 检测通过, 并删除多余字段
   * @defaultValue "error"
   */
  policy?: "pass" | "delete" | "error";

  /**
   * @remarks 为true检测所有预期类型, 为false时返回第一检测不通过的结果
   * @defaultValue false
   */
  checkAll?: boolean;
  /**
   * @remarks 如果设置为true, 对于数组类型和对象类型, 将会进行拷贝
   */
  // new?: boolean;
}
/** @public */
export interface TypeCheckFn<T = any> {
  (
    val: any,
    option: Readonly<TypeCheckOptions>,
  ): Partial<CheckRes<T>> | undefined;
  /** @remarks 前置类型, 前置类型匹配才会执行检测函数, 如果不匹配, 检测直接不通过 */
  baseType?: BasicType;
}
/**
 * @__NO_SIDE_EFFECTS__
 * @public
 * @remarks 生成可选类型检测器
 */
function optional<T extends ExceptType>(
  type: T,
): InternalExceptType<undefined | InferExcept<T>> {
  return new InternalExceptType(type, "optional");
}
optional.number = optional("number");
optional.string = optional("string");
optional.boolean = optional("boolean");
optional.bigint = optional("bigint");
optional.symbol = optional("symbol");
optional.object = optional("object");
optional.function = optional("function");
/**
 * @__NO_SIDE_EFFECTS__
 * @public
 * @remarks 生成可同类数组检测器
 */
function array<T extends ExceptType>(
  type: T,
): InternalExceptType<InferExcept<T>[]> {
  return new InternalExceptType(type, "array");
}
array.number = array("number");
array.string = array("string");
array.boolean = array("boolean");
array.bigint = array("bigint");
array.symbol = array("symbol");
array.object = array("object");
array.function = array("function");
/**
 * @__NO_SIDE_EFFECTS__
 * @public
 * @remarks 生成可同类属性检测器
 */
function record<T extends ExceptType>(
  type: T,
): InternalExceptType<Record<string, InferExcept<T>>> {
  return new InternalExceptType(type, "record");
}
record.number = record("number");
record.string = record("string");
record.boolean = record("boolean");
record.bigint = record("bigint");
record.symbol = record("symbol");
record.object = record("object");
record.function = record("function");
class TypeChecker<T extends ExceptType> {
  private config: Pick<TypeCheckOptions, "checkAll" | "policy">;
  constructor(
    private expect: T,
    opts: Pick<TypeCheckOptions, "checkAll" | "policy">,
  ) {
    if (expect === null)
      throw new ParameterError(
        2,
        createTypeErrorDesc("ExceptType", typeof expect),
        "exceptType",
      );
    this.config = { checkAll: opts.checkAll, policy: opts.policy };
  }
  check(value: any) {
    return internalCheckType(value, this.expect, this.config);
  }
}
/**
 * @__NO_SIDE_EFFECTS__
 * @remarks 生成联合类型检测函数 */
function union<T extends ExceptType[]>(
  types: ExceptType[],
): TypeCheckFn<InferExcept<T>> {
  const checkFn: TypeCheckFn = function testFx(val: any, option) {
    let errors: TypeErrorDesc[] = [];
    for (const except of types) {
      const error = internalCheckType(val, except, option)?.error;
      if (error === undefined) return;
      errors.push(error);
    }
    return { error: errors.join(" | ") };
  };
  return checkFn;
}
/**
 * @public
 * @remarks 预定义的检测函数工厂
 */
export const typeChecker = {
  create<T extends ExceptType>(
    expect: T,
    opts: Pick<TypeCheckOptions, "checkAll" | "policy">,
  ): TypeChecker<T> {
    return new TypeChecker(expect, opts);
  },
  /** @remarks 生成数字范围检测函数 */
  numberRange(min: number, max = Infinity): TypeCheckFn<number> {
    const checkFn: TypeCheckFn = function checkFn(val: number, option) {
      if (val > max || val < min) {
        return {
          error: createTypeErrorDesc(`[${min},${max}]`, val.toString()),
        };
      }
    };
    checkFn.baseType = "number";
    return checkFn;
  },
  /** @remarks 生成实例类型检测函数 */
  instanceof<T extends new (...args: any[]) => any>(
    obj: T,
  ): TypeCheckFn<InstanceType<T>> {
    if (typeof obj !== "function") throw new Error();
    const checkFn: TypeCheckFn = function checkFn(val: object) {
      if (val instanceof obj) return;
      return { error: createTypeErrorDesc(obj.name, getClassType(val)) };
    };
    checkFn.baseType = "object";
    return checkFn;
  },
  /** @remarks 生成联合类型检测函数 */
  union,
  optional,
  array,
  record,
  /** @remarks 生成数组类型检测函数 */
  arrayType<T extends ExceptType>(
    type: T,
    length?: number,
  ): TypeCheckFn<InferExcept<T>> {
    const checkFn: TypeCheckFn = function checkFn(val: any, options) {
      const { checkAll } = options;
      const deleteSurplus = options.policy === "delete";
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
          let res = internalCheckType(item, type);
          if (res.error) {
            errors[i] = res.error;
            if (!checkAll) return { error: errors };
            errCount++;
          }
        }
        if (errCount) return { error: errors };
      } else return { error: createTypeErrorDesc("Array", getClassType(val)) };
    };
    checkFn.baseType = "object";
    return checkFn;
  },
};

type BasicType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "undefined"
  | "object"
  | "function"
  | "null";
/** @remarks 元组项检测 */
type ExceptTypeTuple = ExceptType[];
/**
 * @remarks 对象属性检测
 * @public
 */
type ExceptTypeMap = { [key: string | number]: ExceptType };
/**
 * @public
 * @remarks 类型检测
 * string: BasicType 基础类型检测
 * function: 自定义检测函数
 * true: 检测通过, 可以用于 any类型
 */
export type ExceptType =
  | TypeCheckFn
  | BasicType
  | ExceptTypeMap
  | ExceptTypeTuple
  | InternalExceptType;

type TypeErrorDesc = string | { [key: string]: TypeErrorDesc };
type CheckRes<T = unknown> = {
  error?: TypeErrorDesc;
  /** 要替换的值 */
  value: T;
};

type InferBaseMap = {
  number: number;
  bigint: bigint;
  boolean: boolean;
  undefined: undefined;
  null: null;
  function: Fn;
  object: object;
  symbol: symbol;
  string: string;
  [key: string]: unknown;
};
/**
 * @public
 * @remarks 推断预期类型 */
export type InferExcept<T> = T extends string
  ? InferBaseMap[T]
  : T extends any[]
    ? InferTuple<T>
    : T extends Fn
      ? InferChecker<T>
      : T extends InternalExceptType<infer E>
        ? E
        : T extends object
          ? {
              [key in keyof T]: InferExcept<T[key]>;
            }
          : unknown;

type InferChecker<T extends Fn> = T extends (
  ...args: any
) => Partial<CheckRes<infer V>> | undefined
  ? V
  : unknown;
type InferTuple<T extends any[]> = T extends [infer P, ...infer Q]
  ? [InferExcept<P>, ...InferTuple<Q>]
  : T;

type Fn = (...args: any[]) => any;
