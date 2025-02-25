import { TypeCheckFn } from "../type.ts";
import { createTypeErrorDesc } from "../../core/errors.ts";

/**
 * 生成数字范围检测函数
 * @public
 */
export function numberRange(min: number, max = Infinity): TypeCheckFn<number> {
  const checkFn: TypeCheckFn = function checkFn(val: number, option) {
    if (Number.isNaN(val)) return { error: createTypeErrorDesc("Integer", String(val)) };
    if (val > max || val < min) {
      return {
        error: createTypeErrorDesc(`[${min},${max}]`, val.toString()),
      };
    }
  };
  checkFn.baseType = "number";
  return checkFn;
}
/** @public */
export type NumberCheckOption = {
  /** 默认为 -Infinity */
  min?: number;
  /** 默认为 Infinity */
  max?: number;
  /** 如果为 true, 尝试将字符串转为整数 */
  acceptString?: boolean;
};
/**
 * @public 断言目标是一个整数
 * @param min - 默认 -Infinity
 * @param max - 默认 Infinity
 */
export function integer(min?: number, max?: number): TypeCheckFn<number>;
/**
 * @public 断言目标是一个整数
 */
export function integer(option?: NumberCheckOption): TypeCheckFn<number>;
export function integer(min: number | NumberCheckOption = -Infinity, max: number = Infinity): TypeCheckFn<number> {
  let acceptString: boolean | undefined = false;
  if (typeof min === "object") {
    max = min.max ?? Infinity;
    acceptString = min.acceptString;
    min = min.min ?? -Infinity;
  }

  if (acceptString) {
    const checkFnTransform: TypeCheckFn = function checkFn(value: any, option) {
      let useValue = value;
      if (typeof useValue !== "number") {
        if (typeof useValue === "string") useValue = Number.parseInt(useValue);
        if (!Number.isInteger(useValue)) return { error: createTypeErrorDesc("Integer", String(value)) };
      }
      if (useValue > max || useValue < min) {
        return {
          error: createTypeErrorDesc(`[${min},${max}]`, useValue.toString()),
        };
      }
      return {
        value: useValue,
        replace: useValue !== value,
      };
    };
    return checkFnTransform;
  } else {
    const checkFn: TypeCheckFn = function checkFn(val: number, option) {
      if (!Number.isInteger(val)) return { error: createTypeErrorDesc("Integer", String(val)) };
      if (val > max || val < min) {
        return {
          error: createTypeErrorDesc(`[${min},${max}]`, val.toString()),
        };
      }
    };
    checkFn.baseType = "number";
    return checkFn;
  }
}
