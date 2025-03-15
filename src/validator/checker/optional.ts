import { internalCheckType } from "../check_base.ts";
import { CustomChecker, ExpectType, InferExpect, TYPE_CHECK_FN } from "../type.ts";

interface OptionalChecker {
  <T extends ExpectType>(type: T, mode?: undefined): CustomChecker<InferExpect<T> | undefined>;
  <T extends ExpectType>(type: T, mode: null): CustomChecker<InferExpect<T> | null>;
  <T extends ExpectType>(
    type: T,
    mode?: undefined | null | "nullish",
  ): CustomChecker<InferExpect<T> | undefined | null>;
  <T extends ExpectType, Def = T>(
    type: T,
    mode: undefined | null | "nullish",
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
/**
 * 断言目标是可选类型
 * @public
 */
export const optional: OptionalChecker = /*  @__NO_SIDE_EFFECTS__ */ function optional<
  T extends ExpectType,
>(
  type: T,
  mode: undefined | null | "nullish" = undefined,
  defaultValue?: any,
): CustomChecker<InferExpect<T>> {
  if (mode === "nullish") {
    return {
      optional: true,
      [TYPE_CHECK_FN](val, checkOpts) {
        if (val === undefined || val === null) {
          if (defaultValue !== undefined) return { value: defaultValue, replace: true };
          return;
        }
        return internalCheckType(val, type, checkOpts);
      },
    };
  }

  return {
    optional: true,
    [TYPE_CHECK_FN](val, checkOpts) {
      if (val === mode) {
        if (defaultValue !== undefined) return { value: defaultValue, replace: true };
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
