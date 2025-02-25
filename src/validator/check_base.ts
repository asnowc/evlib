import { createTypeErrorDesc, ParameterError } from "../core/errors.ts";
import { getBasicType, getClassType } from "./get_type.ts";
import type {
  ExpectObjectType,
  ExpectType,
  InferExpect,
  TypeChecker,
  TypeCheckFnCheckResult,
  TypeCheckOptions,
  TypeErrorDesc,
} from "./type.ts";
import { TYPE_CHECK_FN } from "./type.ts";

/**
 * 如果 对象的字段预期类型为可选, 并且实际存在字段为undefined, 则在deleteSurplus为true是将字段删除
 */
export function checkObject(
  doc: Record<string, any>,
  except: ExpectObjectType,
  options: TypeCheckOptions,
): TypeCheckFnCheckResult {
  const error: Record<string, TypeErrorDesc> = {};
  const { checkAll } = options;
  const deleteSurplus = options.policy === "delete";
  const checkProvidedOnly = options.policy == "pass";

  let isErr = false;

  let keys = deleteSurplus || !checkProvidedOnly ? new Set(Object.keys(doc)) : undefined;

  let exist: boolean;
  for (let [testKey, exceptType] of Object.entries(except)) {
    exist = Object.hasOwn(doc, testKey);
    Object.getOwnPropertyDescriptor;

    if (typeof exceptType === "object" && exceptType !== null) {
      const checker = isChecker(exceptType);
      if (exist) {
        if (checker) {
          if (doc[testKey] === undefined && deleteSurplus) {
            delete doc[testKey];
            continue;
          }
        }
      } else {
        if (!checker?.optional) {
          error[testKey] = createTypeErrorDesc("存在", "不存在");
          if (!checkAll) return { error };
          continue;
        }
      }
    }

    const res = internalCheckType(doc[testKey], exceptType, options);
    if (res) {
      if (res.replace) doc[testKey] = res.value;
      else if (res.error) {
        error[testKey] = res.error;
        if (!checkAll) return { error };
        else isErr = true;
      }
    }
    keys?.delete(testKey);
  }
  if (keys?.size) {
    if (deleteSurplus) { for (const key of keys) delete doc[key]; }
    else if (!checkProvidedOnly) {
      for (const key of keys) {
        error[key] = createTypeErrorDesc("不存在", "存在");
      }
      isErr = true;
    }
  }
  if (isErr) return { error };
  return { value: doc, replace: true };
}
export function checkTuple<T = unknown>(
  arr: any[],
  except: ExpectType[],
  options: Readonly<TypeCheckOptions>,
): TypeCheckFnCheckResult<T> {
  const error: Record<string, TypeErrorDesc> = {};
  const { checkAll } = options;
  const deleteSurplus = options.policy === "delete";
  const checkProvidedOnly = options.policy == "pass";

  let isErr = false;
  if (Array.isArray(arr)) {
    let maxLen = except.length;

    if (arr.length != except.length) {
      if (arr.length > except.length && deleteSurplus) {
        arr.length = except.length;
      } else if (arr.length > except.length && checkProvidedOnly) {
      } else {
        if (arr.length < except.length) maxLen = except.length;
        error.length = `预期长度: ${except.length}, 实际: ${arr.length}`;
        if (!checkAll) return { error };
      }
    }
    for (let i = 0; i < maxLen; i++) {
      let exceptType = except[i];
      let actualType = arr[i];
      const res = internalCheckType(actualType, exceptType, options);
      if (!res) continue;
      if (res.replace) arr[i] = res.value;
      else if (res.error) {
        error[i] = res.error;
        if (checkAll) isErr = true;
        else return { error };
      }
    }
  } else {
    return {
      error: createTypeErrorDesc("Array", getClassType(arr)),
    };
  }

  if (isErr) return { error };
}
export function checkUnion(
  arr: any,
  exceptUnion: ExpectType[],
  option: Readonly<TypeCheckOptions>,
) {
  const errors: TypeErrorDesc[] = [];
  for (let i = 0; i < exceptUnion.length; i++) {
    const res = internalCheckType(arr, exceptUnion[i], option);
    if (!res) return;
    if (res.error) errors.push(res.error);
    else {
      return;
    }
  }
  return { error: "没有符合的联合类型： " + errors.join(" | ") };
}
export function internalCheckType<T extends ExpectType>(
  value: any,
  except: T,
  options?: Readonly<TypeCheckOptions>,
): TypeCheckFnCheckResult<InferExpect<T>>;
export function internalCheckType(
  value: any,
  expect: ExpectType,
  opts: Readonly<TypeCheckOptions> = {},
): TypeCheckFnCheckResult<unknown> {
  switch (typeof expect) {
    case "string": {
      let actualType = getBasicType(value);
      if (actualType !== expect) {
        return { error: createTypeErrorDesc(expect, actualType), value };
      }
      break;
    }

    case "object": {
      if (expect !== null) {
        if (expect instanceof Array) return checkUnion(value, expect, opts);
        const checker = isChecker(expect);

        if (checker) {
          if (checker.baseType && typeof value !== expect.baseType) {
            return {
              error: createTypeErrorDesc(checker.baseType, typeof value),
            };
          }
          return checker[TYPE_CHECK_FN](value, opts);
        } else if (getBasicType(value) === "object") {
          return checkObject(value, expect as ExpectObjectType, opts);
        } else {
          return {
            error: createTypeErrorDesc("object", getBasicType(value)),
          };
        }
      }
      break;
    }
    case "function": {
      if (expect.baseType && typeof value !== expect.baseType) {
        return {
          error: createTypeErrorDesc(expect.baseType, typeof value),
        };
      }
      return expect(value, opts);
    }
    default: {
      throw new ParameterError(
        2,
        createTypeErrorDesc("ExpectType", typeof expect),
        "exceptType",
      );
    }
  }
}
function isChecker(value: object): TypeChecker | undefined {
  if (typeof Reflect.get(value, TYPE_CHECK_FN) === "function") {
    return value as TypeChecker;
  }
}
