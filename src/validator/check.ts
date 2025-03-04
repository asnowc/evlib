import { internalCheckType } from "./check_base.ts";
import { ExpectType, InferExpect, TypeCheckOptions, TypeErrorDesc } from "./type.ts";
/**
 * 校验数据类型，如果校验不通过，则返回异常信息
 * @public
 */
export function checkType<T extends ExpectType>(
  value: any,
  except: T,
  options?: TypeCheckOptions,
): TypeCheckResult<InferExpect<T>>;
export function checkType(
  value: any,
  expect: ExpectType,
  opts: TypeCheckOptions = {},
): TypeCheckResult<unknown> {
  const res = internalCheckType(value, expect, {
    checkAll: opts.checkAll,
    policy: opts.policy,
  });
  if (!res) return { value };
  if (res.error) return { value, error: res.error };
  else if (res.replace) return { value: res.value };
  return { value };
}
/** @public */
export type TypeCheckResult<T = unknown> = {
  /** 异常信息 */
  error?: TypeErrorDesc;
  /** 要替换的值 */
  value: T;
};
/**
 * 校验数据类型，如果校验不同过，则抛出异常
 * @public
 */
export function verifyType<T extends ExpectType>(
  input: any,
  expect: T,
  option?: TypeCheckOptions,
): InferExpect<T> {
  const { value, error } = checkType(input, expect, option);
  if (error) throw new Error("参数校验不通过", { cause: error });
  return value;
}
export * from "./checker/mod.ts";
