/**
 * 生成 0 ~ max 的随机整数
 * @public
 */
export function randomInt(max: number): number;
/**
 * 生成 min ~ max 的随机整数
 * @public
 */
export function randomInt(min: number, max: number): number;
export function randomInt(min_max: number, max?: number): number {
  if (max === undefined) {
    return Math.floor(Math.random() * min_max);
  }
  return Math.floor(min_max + Math.random() * (max - min_max));
}
