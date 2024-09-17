import { createTypeErrorDesc } from "../errors.ts";
import { getClassType } from "./get_type.ts";
import { internalCheckType } from "./check_base.ts";
import {
  CustomChecker,
  ExpectType,
  InferExpect,
  TYPE_CHECK_FN,
  TypeChecker,
  TypeCheckFn,
  TypeCheckFnCheckResult,
  TypeCheckOptions,
  TypeErrorDesc,
} from "./type.ts";

function checkArray<T>(
  val: any[],
  type: ExpectType,
  checkAll?: boolean,
): TypeCheckFnCheckResult<T[]> {
  let errCount = 0;
  let errors: any = {};

  for (let i = 0; i < val.length; i++) {
    let item = val[i];
    let res = internalCheckType(item, type);
    if (!res) continue;
    if (res.replace) val[i] = res.value;
    else if (res.error) {
      errors[i] = res.error;
      errCount++;
      if (!checkAll) return { error: errors };
    }
  }
  if (errCount) return { error: errors };
}
function checkRecord<T>(
  val: Record<string, any>,
  type: ExpectType,
  checkAll?: boolean,
): TypeCheckFnCheckResult<Record<string, T>> {
  let errCount = 0;
  let errors: any = {};
  const list = Object.keys(val);
  let key: string;
  for (let i = 0; i < list.length; i++) {
    key = list[i];
    let res = internalCheckType(val[key], type);
    if (!res) continue;
    if (res.replace) val[key] = res.value;
    else if (res.error) {
      errors[key] = res.error;
      errCount++;
      if (!checkAll) return { error: errors };
    }
  }
  if (errCount) return { error: errors };
}
interface OptionalChecker {
  <T extends ExpectType>(type: T): CustomChecker<InferExpect<T> | undefined>;
  <T extends ExpectType, Def = T>(
    type: T,
    defaultValue: Def,
  ): CustomChecker<InferExpect<T> | Def>;
  number: CustomChecker<number | undefined>;
  string: CustomChecker<string | undefined>;
  boolean: CustomChecker<boolean | undefined>;
  bigint: CustomChecker<bigint | undefined>;
  symbol: CustomChecker<symbol | undefined>;
  object: CustomChecker<object | undefined>;
  function: CustomChecker<((...args: any[]) => any) | undefined>;
}
/** 生成可选类型检测器
 * @public
 */
const optional: OptionalChecker = /*  @__NO_SIDE_EFFECTS__ */ function optional<
  T extends ExpectType,
>(
  type: T,
  def?: any,
): TypeCheckFn<InferExpect<T>> | TypeChecker<InferExpect<T>> {
  return {
    optional: true,
    [TYPE_CHECK_FN](val, checkOpts) {
      if (val === undefined) {
        if (def !== undefined) return { value: def, replace: true };
        return;
      }
      return internalCheckType(val, type, checkOpts);
    },
  };
};
optional.number = optional("number");
optional.string = optional("string");
optional.boolean = optional("boolean");
optional.bigint = optional("bigint");
optional.symbol = optional("symbol");
optional.object = optional("object");
optional.function = optional("function");

interface ArrayChecker {
  <T extends ExpectType>(
    type: T,
    length?: number,
  ): TypeChecker<InferExpect<T>[]>;
  number: TypeChecker<number[]>;
  string: TypeChecker<string[]>;
  boolean: TypeChecker<boolean[]>;
  bigint: TypeChecker<bigint[]>;
  symbol: TypeChecker<symbol[]>;
  object: TypeChecker<object[]>;
  function: TypeChecker<((...args: any[]) => any)[]>;
}

/**
 * 生成可同类数组检测器
 * @public
 */
const array: ArrayChecker = /*  @__NO_SIDE_EFFECTS__ */ function array<
  T extends ExpectType,
>(
  type: T,
  length?: number,
): TypeChecker<InferExpect<T>[]> {
  if (length !== undefined) {
    return {
      baseType: "object",
      [TYPE_CHECK_FN]: arrayType(type, length),
    };
  }
  return {
    baseType: "object",
    [TYPE_CHECK_FN](val: any[], checkOpts) {
      return checkArray(val, type, checkOpts.checkAll);
    },
  };
};
array.number = array("number");
array.string = array("string");
array.boolean = array("boolean");
array.bigint = array("bigint");
array.symbol = array("symbol");
array.object = array("object");
array.function = array("function");

interface RecordChecker {
  <T extends ExpectType>(type: T): TypeChecker<Record<string, InferExpect<T>>>;
  number: TypeChecker<Record<string, number>>;
  string: TypeChecker<Record<string, string>>;
  boolean: TypeChecker<Record<string, boolean>>;
  bigint: TypeChecker<Record<string, bigint>>;
  symbol: TypeChecker<Record<string, symbol>>;
  object: TypeChecker<Record<string, object>>;
  function: TypeChecker<Record<string, (...args: any[]) => any>>;
}
/** 生成可同类属性检测器
 * @public */

const record: RecordChecker = /*  @__NO_SIDE_EFFECTS__ */ function record<
  T extends ExpectType,
>(
  type: T,
): TypeChecker<Record<string, InferExpect<T>>> {
  return {
    [TYPE_CHECK_FN](val, checkOpts) {
      return checkRecord(val, type, checkOpts.checkAll);
    },
  };
};
record.number = record("number");
record.string = record("string");
record.boolean = record("boolean");
record.bigint = record("bigint");
record.symbol = record("symbol");
record.object = record("object");
record.function = record("function");

class Union<T> implements TypeChecker<T> {
  constructor(readonly types: ExpectType[]) {}
  [TYPE_CHECK_FN](
    val: any,
    option: Readonly<TypeCheckOptions>,
  ): TypeCheckFnCheckResult<T>;
  [TYPE_CHECK_FN](val: any, option: Readonly<TypeCheckOptions>) {
    let errors: TypeErrorDesc[] = [];
    for (const except of this.types) {
      const res = internalCheckType(val, except, option);
      if (!res || res.replace || !res.error) return res;
      errors.push(res.error);
    }
    return { error: errors.join(" | ") };
  }
}
/** 生成数字范围检测函数
 * @public */
function numberRange(min: number, max = Infinity): TypeCheckFn<number> {
  const checkFn: TypeCheckFn = function checkFn(val: number, option) {
    if (val > max || val < min) {
      return {
        error: createTypeErrorDesc(`[${min},${max}]`, val.toString()),
      };
    }
  };
  checkFn.baseType = "number";
  return checkFn;
}

/** 生成实例类型检测函数
 * @public */
function instanceOf<T extends new (...args: any[]) => any>(
  obj: T,
): TypeCheckFn<InstanceType<T>> {
  if (typeof obj !== "function") throw new Error();
  const checkFn: TypeCheckFn = function checkFn(val: object) {
    if (val instanceof obj) return;
    return { error: createTypeErrorDesc(obj.name, getClassType(val)) };
  };
  checkFn.baseType = "object";
  return checkFn;
}

/** 生成联合类型检测函数
 * @public  */
function union<T extends ExpectType[]>(
  types: T,
): TypeCheckFn<InferExpect<T[number]>> | TypeChecker<InferExpect<T[number]>> {
  return new Union(types);
}
/** 生成数组类型检测函数
 * @public
 * @deprecated 改用 array
 */
function arrayType<T extends ExpectType>(
  type: T,
  length?: number,
): TypeCheckFn<InferExpect<T>[]> {
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
        if (!res) continue;
        if (res.replace) val[i] = res.value;
        else if (res.error) {
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
}
/** 检测可能为 null 的类型 */
function maybeNull<T extends ExpectType>(
  expect: T,
): TypeCheckFn<InferExpect<T> | null>;
/** 检测可能为 null 的类型 */
function maybeNull<T extends ExpectType, Def = T>(
  expect: T,
  defaultValue: any,
): TypeCheckFn<InferExpect<T> | Def>;
function maybeNull<T extends ExpectType>(
  expect: T,
  defaultValue?: any,
): TypeCheckFn<InferExpect<T> | null> {
  return function (value, option) {
    if (value === null) {
      if (defaultValue !== undefined && defaultValue !== null) {
        return { replace: true, value: defaultValue };
      }
      return;
    }
    return internalCheckType(value, expect, option);
  };
}
/** 检测可能为 null 或 undefined 的类型 */
function maybeNullish<T extends ExpectType>(
  expect: T,
  optional?: boolean,
): TypeChecker<InferExpect<T> | null | undefined>;
function maybeNullish<T extends ExpectType, Def = T>(
  expect: T,
  optional: boolean,
  defaultValue: Def,
): TypeChecker<InferExpect<T> | Def>;
function maybeNullish(
  expect: ExpectType,
  optional = true,
  defaultValue?: any,
): TypeChecker<any | null | undefined> {
  return {
    optional,
    [TYPE_CHECK_FN](val, checkOpts) {
      if (val === undefined || val === null) {
        if (val !== defaultValue) return { replace: true, value: defaultValue };
        return;
      }
      return internalCheckType(val, expect, checkOpts);
    },
  };
}
/** 检测枚举类型 */
function enumType<T>(expects: T[]): TypeCheckFn<T> {
  return (v, option) => {
    if (expects.includes(v)) return;
    return { error: `${v} 不在枚举${expects.join(", ")} 中` };
  };
}
/** 预定义的检测函数工厂
 * @public
 */
export const typeChecker = {
  record,
  array,
  optional,
  numberRange,
  /** @deprecated 改用 instanceOf代替 */
  instanceof: instanceOf,
  /** @deprecated 改用 array 代替 */
  arrayType,
  instanceOf,
  union,
  enumType,
  maybeNull,
  maybeNullish,
};
