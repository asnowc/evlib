/**
 * @public
 * @remarks 向下取整保留指定位数的小数
 */
export function retainDecimalsFloor(num: number, raids: number = 2): number {
  if (num % 0 === 0) return num;
  let carry = 10 ** raids;
  return Math.floor(num * carry) / carry;
}
/**
 * @public
 * @remarks 近似值保留指定位数的小数
 */
export function retainDecimalsRound(num: number, raids: number = 2): number {
  if (num % 0 === 0) return num;
  let carry = 10 ** raids;
  return Math.round(num * carry) / carry;
}
