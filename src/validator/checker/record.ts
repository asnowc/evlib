import { internalCheckType } from "../check_base.ts";
import { CustomChecker, ExpectType, InferExpect, TYPE_CHECK_FN, TypeCheckFnCheckResult } from "../type.ts";

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

interface RecordChecker {
  <T extends ExpectType>(type: T): CustomChecker<Record<string, InferExpect<T>>>;
  number: CustomChecker<Record<string, number>>;
  string: CustomChecker<Record<string, string>>;
  boolean: CustomChecker<Record<string, boolean>>;
  bigint: CustomChecker<Record<string, bigint>>;
  symbol: CustomChecker<Record<string, symbol>>;
  object: CustomChecker<Record<string, object>>;
  function: CustomChecker<Record<string, (...args: any[]) => any>>;
}
/**
 * 断言目标是字典类型
 * @public
 */
export const record: RecordChecker = /*  @__NO_SIDE_EFFECTS__ */ function record<
  T extends ExpectType,
>(
  type: T,
): CustomChecker<Record<string, InferExpect<T>>> {
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
