import { BasicType } from "./type.ts";

/** 获取数据类型。在typeof之上区分null
 * @public
 */
export function getBasicType(val: any): BasicType {
  return val === null ? "null" : typeof val;
}
/** 获取对象的类名, 如果val为基础类型, 则返回基础类型
 * @public
 */
export function getClassType(val: any): string {
  let basicType = getBasicType(val);
  if (basicType === "object") {
    let type: string = val.constructor?.name ?? "Object";
    return type;
  } else return basicType;
}
