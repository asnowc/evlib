import { getClassType } from "../get_type.ts";
import { internalCheckType } from "../check_base.ts";
import {
  CustomChecker,
  ExpectType,
  InferExpect,
  TYPE_CHECK_FN,
  TypeCheckFnCheckResult,
  TypeCheckOptions,
} from "../type.ts";
import { createTypeErrorDesc } from "../../core/errors.ts";

interface ArrayChecker {
  <T extends ExpectType>(
    type: T,
    option?: {
      maxLen?: number;
      minLen?: number;
    },
  ): CustomChecker<InferExpect<T>[]>;
  number: CustomChecker<number[]>;
  string: CustomChecker<string[]>;
  boolean: CustomChecker<boolean[]>;
  bigint: CustomChecker<bigint[]>;
  symbol: CustomChecker<symbol[]>;
  object: CustomChecker<object[]>;
  function: CustomChecker<((...args: any[]) => any)[]>;
}

/**
 * 生成可同类数组检测器
 * @public
 */
export const array: ArrayChecker = /*  @__NO_SIDE_EFFECTS__ */ function array<
  T extends ExpectType,
>(
  type: T,
  option: {
    maxLen?: number;
    minLen?: number;
  } = {},
): CustomChecker<InferExpect<T>[]> {
  return {
    baseType: "object",
    [TYPE_CHECK_FN](val, checkOpts) {
      return checkArray(val, type, checkOpts, option);
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

function checkArray<T>(
  val: any[],
  type: ExpectType,
  checkOpts: TypeCheckOptions,
  option: {
    maxLen?: number;
    minLen?: number;
  } = {},
): TypeCheckFnCheckResult<T[]> {
  if (!Array.isArray(val)) return { error: createTypeErrorDesc("Array", getClassType(val)) };
  const { maxLen, minLen } = option;

  const errors: Record<string | number, any> = {};
  let errCount = 0;

  if (maxLen !== undefined && val.length > maxLen) {
    if (checkOpts.policy === "delete") val.length = maxLen;
    else {
      errors.length = createTypeErrorDesc(`最大 ${maxLen}`, val.length.toString());
      errCount++;
      if (!checkOpts.checkAll) return { error: errors };
    }
  }
  if (minLen !== undefined && val.length < minLen) {
    errors.length = createTypeErrorDesc(`最小 ${minLen}`, val.length.toString());
    if (!checkOpts.checkAll) return { error: errors };
  }

  for (let i = 0; i < val.length; i++) {
    let item = val[i];
    let res = internalCheckType(item, type);
    if (!res) continue;
    if (res.replace) val[i] = res.value;
    else if (res.error) {
      errors[i] = res.error;
      errCount++;
      if (!checkOpts.checkAll) return { error: errors };
    }
  }
  if (errCount) return { error: errors };
}
