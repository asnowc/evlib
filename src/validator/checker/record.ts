import { internalCheckType } from "../check_base.ts";
import { ExpectType, InferExpect, TYPE_CHECK_FN, TypeChecker, TypeCheckFnCheckResult } from "../type.ts";

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
  <T extends ExpectType>(type: T): TypeChecker<Record<string, InferExpect<T>>>;
  number: TypeChecker<Record<string, number>>;
  string: TypeChecker<Record<string, string>>;
  boolean: TypeChecker<Record<string, boolean>>;
  bigint: TypeChecker<Record<string, bigint>>;
  symbol: TypeChecker<Record<string, symbol>>;
  object: TypeChecker<Record<string, object>>;
  function: TypeChecker<Record<string, (...args: any[]) => any>>;
}
/**
 * 生成可同类属性检测器
 * @public
 */
export const record: RecordChecker = /*  @__NO_SIDE_EFFECTS__ */ function record<
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
