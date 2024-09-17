import { internalCheckType } from "./type_check/check_base.ts";
import {
  ExpectType,
  InferExpect,
  TypeCheckOptions,
  TypeErrorDesc,
} from "./type_check/type.ts";
/** @public */
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
  if (res.replace) return { value: res.value };
  else if (res.error) return { value, error: res.error };
  return { value };
}
type TypeCheckResult<T = unknown> = {
  error?: TypeErrorDesc;
  /** 要替换的值 */
  value: T;
};

export * from "./type_check/get_type.ts";
export * from "./type_check/type_checker.ts";
export * from "./type_check/type.ts";
