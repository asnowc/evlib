import { CustomChecker, TypeCheckFn } from "../type.ts";

/**
 * @public 断言目标能够被正则表达式匹配
 */
export function stringMatch(regexp: RegExp): CustomChecker<string> {
  const checkFn: TypeCheckFn = function checkFn(value: string, option) {
    if (!regexp.test(value)) return { error: `预期能够被正则 ${regexp.source} 匹配` };
  };
  checkFn.baseType = "string";
  return checkFn;
}
