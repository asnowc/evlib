import {
  ParameterError,
  NumericalRangeError,
  ParameterTypeError,
} from "evlib/errors";
import { retainDecimalsFloor } from "./float.ts";

/** @public */
export type ExponentFormat = {
  int: number;
  decimals: number;
  exponent: number;
};
/** 将数字标准化  (int + decimals) * carry ^ exponent
 * @public
 * @param carry - 进位值
 * @param maxExponent - 指数上限，默认无上限（直到 int 小于 carry）
 * @returns
 * int: 整数部分
 * decimals: 小数部分
 * exponent: 指数
 */
export function paseExponentNum(
  num: number,
  carry: number,
  maxExponent?: number
): ExponentFormat;
/** 使用动态进位值标准化数字  (int + decimals) * carry ^ exponent
 * @public
 * @param carry - 一个数组（每次进位的数值）
 * @param maxExponent - 指数上限，默认无上限（直到 int 小于 carry）
 * @returns
 * int: 整数部分
 * decimals: 小数部分
 * exponent: 指数
 */
export function paseExponentNum(num: number, carry: number[]): ExponentFormat;
export function paseExponentNum(
  num: number,
  carry: number | number[],
  maxExponent: number = Infinity
): ExponentFormat {
  if (isNaN(num) || num === Infinity)
    throw new ParameterError(0, `Invalid number (${num}) `, "num");

  let exponent = 0;
  let decimals: number = num % 1;
  const negative = num < 0;
  if (negative) num = -1 * num;

  if (decimals !== 0) num = Math.floor(num);

  if (typeof carry === "number") {
    if (carry < 0) throw new NumericalRangeError(1, undefined, "carry");

    while (num >= carry && exponent < maxExponent) {
      decimals = ((num % carry) + decimals) / carry;
      num = Math.floor(num / carry);
      exponent++;
    }
  } else if (carry instanceof Array) {
    if (carry.length === 0)
      throw new ParameterError(1, `Array length cannot be 0`, "carry");

    const carryList = carry;
    for (let i = 0; i < carryList.length && exponent < maxExponent; i++) {
      carry = carryList[i];
      decimals = (num % carry) / carry + Math.floor(decimals / carry);
      num = Math.floor(num / carry);
      exponent++;
    }
  } else throw new ParameterTypeError(1, "number | number[]", typeof carry);

  return { int: negative ? -1 * num : num, decimals, exponent };
}

/** @public */
export const autoUnit = {
  /**  标准化字节单位
   * @param number - 字节数值
   * @param raids - 保留小数位数。
   * @param unit - number 的单位
   */
  byte(
    number: number,
    raids: number = 2,
    unit?: "B" | "KB" | "MB" | "GB" | "TB" | "PB"
  ) {
    const unitList = ["B", "KB", "MB", "GB", "TB", "PB"];
    let startIndex = 0;
    if (unit) {
      let index = unitList.findIndex((item) => item === unit);
      if (index > 0) startIndex += index;
    }
    let { exponent, decimals, int } = paseExponentNum(
      number,
      1024,
      unitList.length - startIndex
    );
    exponent += startIndex;

    if (decimals > 0) int = retainDecimalsFloor(int + decimals, raids);

    return int + unitList[exponent];
  },
};
