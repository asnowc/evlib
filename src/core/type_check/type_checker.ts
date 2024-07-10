import { createTypeErrorDesc } from "../errors.ts";
import { getClassType } from "./get_type.ts";
import { internalCheckType } from "./check_base.ts";
import {
  CustomChecker,
  ExceptType,
  InferExcept,
  TYPE_CHECK_FN,
  TypeChecker,
  TypeCheckFn,
  TypeCheckFnCheckResult,
  TypeCheckOptions,
  TypeErrorDesc,
} from "./type.ts";

function checkArray<T>(
  val: any[],
  type: ExceptType,
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
  type: ExceptType,
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
  <T extends ExceptType>(type: T): CustomChecker<InferExcept<T>>;
  number: CustomChecker<number>;
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
  T extends ExceptType,
>(
  type: T,
): TypeCheckFn<InferExcept<T>> | TypeChecker<InferExcept<T>> {
  return {
    optional: true,
    [TYPE_CHECK_FN](val, checkOpts) {
      if (val === undefined) return;
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
  <T extends ExceptType>(type: T): TypeChecker<InferExcept<T>[]>;
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
  T extends ExceptType,
>(type: T): TypeChecker<InferExcept<T>[]> {
  return {
    [TYPE_CHECK_FN](val, checkOpts) {
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
  <T extends ExceptType>(type: T): TypeChecker<Record<string, InferExcept<T>>>;
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
  T extends ExceptType,
>(
  type: T,
): TypeChecker<Record<string, InferExcept<T>>> {
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
  constructor(readonly types: ExceptType[]) {}
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
function union<T extends ExceptType[]>(
  types: ExceptType[],
): TypeCheckFn<InferExcept<T>> | TypeChecker<InferExcept<T>> {
  return new Union(types);
}
/** 生成数组类型检测函数
 * @public */
function arrayType<T extends ExceptType>(
  type: T,
  length?: number,
): TypeCheckFn<InferExcept<T>[]> {
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
  instanceOf,
  union,
  arrayType,
};
