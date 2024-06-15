/**
 * 生成指定长度的数组
 * @public
 */
export function createList<T>(
  fn: (index: number) => T,
  size: number,
  startIndex = 0
): T[] {
  if (size <= 0) throw new RangeError("size can't be less then 0");
  const arr = new Array(size);
  for (let i = 0; i < size; i++) arr[i] = fn(i + startIndex);
  return arr;
}
