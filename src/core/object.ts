import { ParameterTypeError } from "./errors.ts";
import { ObjectKey } from "./type.ts";

type Obj<V = any> = Record<ObjectKey, V>;
/** @public */
export type PatchObjectOpts = {
  /** 跳过 undefined 的值 */
  skipUndefined?: boolean;
  /** 数组合并策略  */
  arrayStrategy?: "unshift" | "push" | "replace";
};
/** 将 from 的可枚举键深度覆盖到 to
 * @public
 */
export function patchObject<T = unknown>(
  from: Obj,
  to: Obj,
  opts: PatchObjectOpts = {},
): T {
  for (const [key, val] of Object.entries(from)) {
    if (val === undefined && opts.skipUndefined) continue;
    if (typeof val === "object" && val !== null) {
      const toObj = to[key];
      if (typeof toObj !== "object" || toObj === null) to[key] = deepClone(val);
      else if (val instanceof Array && toObj instanceof Array) {
        if (opts.arrayStrategy === "push") toObj.push(...val);
        else if (opts.arrayStrategy === "unshift") toObj.unshift(...val);
        else to[key] = val;
      } else patchObject(val, toObj, opts);
    } else to[key] = val;
  }
  return to;
}
/** 对对象数组进行分组
 * @beta
 */
export function groupObject<T extends {}>(data: T[], key: keyof T): Obj<T> {
  let res: Obj = {};
  for (const it of data) {
    let id = it[key] as ObjectKey;
    let group = res[id];
    if (!group) {
      group = [];
      res[id] = group;
    }
    group.push(it);
  }
  return res;
}

/** 删除值为 undefined 的可枚举的键
 * @param deep - 是否递归遍历删除
 * @public
 */
export function removeUndefinedKey<T extends Obj>(obj: T, deep = true): T {
  const removed = new Set();
  removed.add(obj);
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) delete obj[key];
    if (deep && typeof val === "object" && val !== null) {
      if (!removed.has(val)) removeUndefinedKey(val, deep);
    }
  }
  return obj;
}

/** 选取指定的可枚举的键值
 * @public
 * @param target - 将选择的键值加入到 target 中, 而不是返回新对象
 */
export function pickObjectKey<P extends {}>(
  obj: Object,
  keys: (keyof P)[] | Set<keyof P>,
  target?: Object,
): P;
/** @public */
export function pickObjectKey(
  obj: Object,
  keys: string[] | Set<any>,
  target?: Object,
): Record<string, unknown>;
export function pickObjectKey(
  obj: Object,
  keys: any[] | Set<any>,
  target: Record<string, any> = {},
): unknown {
  if (!(keys instanceof Set)) keys = new Set(keys);
  for (const [k, v] of Object.entries(obj)) {
    if (keys.has(k)) target[k] = v;
  }
  return target as any;
}
/** 深度克隆对象，支持克隆 Array
 * @public
 */
export function deepClone<T>(
  obj: T,
  cloned: Map<any, any> = new Map<any, any>(),
): T {
  if (cloned.has(obj)) return cloned.get(obj);

  if (obj instanceof Array) return deepCloneArray(obj, cloned);
  else if (typeof obj === "object" && obj !== null) {
    return deepCloneObject(obj, cloned);
  }
  throw new ParameterTypeError(0, "object", obj === null ? "null" : typeof obj, "obj");
}
function deepCloneArray(obj: unknown[], cloned: Map<any, any>) {
  let newObj: unknown[] = [];
  cloned.set(obj, newObj);

  for (let k = 0, max = obj.length; k < max; k++) {
    const v = obj[k];
    if (typeof v === "object" && v !== null) {
      newObj[k] = deepClone(v, cloned);
    } else newObj[k] = v;
  }
  return newObj as any;
}

function deepCloneObject(obj: Object, cloned: Map<any, any>) {
  if (obj === null) return null;
  let newObj: any = {};
  cloned.set(obj, newObj);
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "object" && v !== null) {
      newObj[k] = deepClone(v, cloned);
    } else newObj[k] = v;
  }
  return newObj;
}
