import { getClassType } from "../get_type.ts";
import { internalCheckType } from "../check_base.ts";
import {
  ExpectType,
  InferExpect,
  TYPE_CHECK_FN,
  TypeChecker,
  TypeCheckFn,
  TypeCheckFnCheckResult,
  TypeCheckOptions,
  TypeErrorDesc,
} from "../type.ts";
import { createTypeErrorDesc } from "../../core/errors.ts";

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

/**
 * 生成实例类型检测函数
 * @public
 */
export function instanceOf<T extends new (...args: any[]) => any>(
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

/**
 * 生成联合类型检测函数
 * @public
 */
export function union<T extends ExpectType[]>(
  types: T,
): TypeCheckFn<InferExpect<T[number]>> | TypeChecker<InferExpect<T[number]>> {
  return new Union(types);
}

/**
 * 检测枚举类型
 * @public
 */
export function enumType<T>(expects: T[]): TypeCheckFn<T> {
  return (v, option) => {
    if (expects.includes(v)) return;
    return { error: `${v} 不在枚举${expects.join(", ")} 中` };
  };
}
