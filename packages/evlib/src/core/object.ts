type Obj = Record<string | number | symbol, any>;
//TODO: 单元测试
/**
 * @remarks 将 from 的可枚举键深度覆盖到 to
 * @beta
 */
export function patchObject(from: Obj, to: Obj) {
  for (const [key, val] of Object.entries(from)) {
    if (typeof val === "object") {
      if (val === null) to[key] = null;
      let toObj = to[key];
      if (typeof toObj !== "object" || toObj === null) to[key] = val;
      else patchObject(val, toObj);
    } else to[key] = val;
  }
  return from;
}
/**
 * @remarks 对对象数组进行分组
 * @beta
 */
export function objectGroup<Key, T extends Obj>(data: T[], key: keyof T) {
  let res = new Map<Key, T[]>();
  for (const it of data) {
    let id = it[key] as Key;
    let group = res.get(id);
    if (!group) {
      group = [];
      res.set(id, group);
    }
    group.push(it);
  }
  return res;
}

/**
 * @remarks 删除值为 undefined 的可枚举的键
 * @param deep - 是否递归遍历删除
 * @beta
 */
export function removeUndefinedKey<T extends Obj>(obj: T, deep = true): T {
  for (const key of Object.keys(obj)) {
    let val = obj[key];
    if (val === undefined) delete obj[key];
    if (deep && typeof val === "object" && val !== null) removeUndefinedKey(val);
  }
  return obj;
}

/**
 * @beta
 * @remarks 选取指定的可枚举的键值
 * @param target - 将选择的键值加入到 target 中, 而不是返回新对象
 */
export function pickObject<P extends {}>(obj: P, keys: (keyof P)[] | Set<any>, target?: Object): P;
/** @beta */
export function pickObject<P extends {}>(obj: P, keys: string[] | Set<any>, target?: Object): P;
export function pickObject<P extends {}>(
  obj: P,
  keys: (keyof P)[] | Set<any>,
  target: Record<string, any> = {}
): unknown {
  if (!(keys instanceof Set)) keys = new Set(keys);
  for (const [k, v] of Object.entries(obj)) {
    if (keys.has(k)) target[k] = v;
  }
  return target as any;
}
/**
 * @beta
 * @remarks 深度克隆对象
 */
export function deepClone<T>(obj: T, cloned: Map<any, any> = new Map<any, any>()): T {
  if (obj instanceof Array) {
    const newObj: any[] = [];
    for (let k = 0, max = newObj.length; k < max; k++) {
      const v = newObj[k];
      if (typeof v === "object" && v !== null) {
        if (cloned.has(v)) newObj[k] = cloned.get(v);
        else {
          newObj[k] = deepClone(v, cloned);
          cloned.set(v, newObj[k]);
        }
      } else newObj[k] = v;
    }
    return newObj as any;
  } else if (typeof obj === "object" && obj !== null) {
    const newObj: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "object" && v !== null) {
        if (cloned.has(v)) newObj[k] = cloned.get(v);
        else {
          newObj[k] = deepClone(v, cloned);
          cloned.set(v, newObj[k]);
        }
      } else newObj[k] = v;
    }
    return newObj;
  }
  return obj;
}
