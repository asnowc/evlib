import { getClassType } from "../get_type.ts";
import { checkTuple } from "../check_base.ts";
import { CustomChecker, ExpectType, InferExpect, TypeCheckFn } from "../type.ts";
import { createTypeErrorDesc } from "../../core/errors.ts";

/** @public */
export type InferExpectTuple<T extends any[]> = T extends [infer P, ...infer Q]
  ? [InferExpect<P>, ...InferExpectTuple<Q>]
  : T;

/** @public */
export function tuple<T extends ExpectType[]>(expect: T): CustomChecker<InferExpectTuple<T>> {
  const checkFn: TypeCheckFn<any> = function (value, option) {
    if (!Array.isArray(value)) return { error: createTypeErrorDesc("Array", getClassType(value)) };
    return checkTuple(value, expect, option);
  };
  checkFn.baseType = "object";

  return checkFn;
}

/**
 * 生成实例类型检测函数
 * @public
 */
export function instanceOf<T extends new (...args: any[]) => any>(
  obj: T,
): CustomChecker<InstanceType<T>> {
  if (typeof obj !== "function") throw new Error();
  const checkFn: TypeCheckFn = function checkFn(val: object) {
    if (val instanceof obj) return;
    return { error: createTypeErrorDesc(obj.name, getClassType(val)) };
  };
  checkFn.baseType = "object";
  return checkFn;
}

/**
 * 检测枚举类型
 * @public
 */
export function enumType<T>(expects: T[]): CustomChecker<T> {
  return (v, option) => {
    if (expects.includes(v)) return;
    return { error: `${v} 不在枚举${expects.join(", ")} 中` };
  };
}
