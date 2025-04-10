/** 数字范围错误, 通常用于参数校验
 * @public
 */
export class NumericalRangeError extends RangeError {
  constructor(min?: number, max?: number, valueName = "numerical range") {
    const invalid = valueName + " exception";
    let msg = "";
    if (min === undefined && max !== undefined) {
      msg = `${invalid}: The ${valueName} cannot be greater than ${max}`;
    } else if (min !== undefined && max === undefined) {
      msg = `${invalid}: The ${valueName} cannot be smaller than ${min}`;
    } else if (min === undefined && max === undefined) msg = invalid;
    else msg = `The ${valueName} must be in [${min}, ${max}]`;
    super(msg);
  }
}
