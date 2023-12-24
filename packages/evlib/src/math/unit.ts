//TODO: 待优化
//TODO: 待导出

/**
 * @alpha
 * @remarks 标准化单位
 */
export function initUnit(num: number, carry: number, max: number = Infinity) {
  if (isNaN(num) || num === Infinity) throw new Error("Invalid num");
  if (carry < 0) throw new Error("Invalid carry");

  let bit = 0;
  let decimals: number = 0;
  while (num >= carry && bit < max) {
    decimals = (num % carry) / carry + Math.floor(decimals / carry);
    num = Math.floor(num / carry);
    bit++;
  }
  return { num, decimals, bit };
}
/**
 * @alpha
 * @remarks 标准化字节单位
 */
export function byteInit(byte: number, raids: number = 2) {
  const unit = ["B", "KB", "MB", "GB", "TB", "PB"];
  let { bit, decimals, num } = initUnit(byte, 1024, unit.length);

  if (decimals > 0) {
    num += Math.round(decimals * 10 ** raids) / 10 ** raids;
  }
  return num + unit[bit];
}

// console.log(byteInit(512));
// console.log(byteInit(1024));
// console.log(byteInit(2099));
byteInit(1024 + 512);
byteInit(1999);
