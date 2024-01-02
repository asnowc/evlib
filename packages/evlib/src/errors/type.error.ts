/**
 * @public
 * @remarks 创建一个类型错误的描述
 */
export function createTypeErrorDesc(except: string, actual: string) {
  return `预期: ${except}, 实际: ${actual}`;
  //return `Except: ${except}, actual: ${actual}`;
}
/**
 * @public
 * @deprecated 将于 2.0.0 移除，改用 createTypeErrorDesc
 * @remarks 创建一个类型错误的描述
 */
export const createErrDesc = createTypeErrorDesc;
/** @public */
export class TypeError extends Error {
  constructor(public cause: TypeErrorDesc, msg?: string) {
    if (!msg) msg = "类型不匹配";
    super(msg, { cause });
  }
}

type TypeErrorDesc = string | { [key: string]: TypeErrorDesc };
/**
 * @public
 * @example 参数 2(msg) 错误: xxxx
 */
export class ParameterError extends Error {
  private static readonly msg = "错误";
  /**
   * @param index 异常参数的索引 （从 1 开始）
   */
  constructor(index: number, cause: string, name?: string) {
    const msg = name ? `${index}(${name})` : index.toString();
    super(`参数 ${msg} 错误: ${cause}`);
  }
}

/**
 * @public
 * @example 参数 2(msg) 错误: xxxx
 */
export class ParameterTypeError extends ParameterError {
  constructor(index: number, except: string, actual: string, name?: string) {
    super(index, createTypeErrorDesc(except, actual), name);
  }
}
/**
 * @public
 * @deprecated 将在 2.0.0 移除。 改用 ParameterError  */
export const ParametersError = ParameterError;
/**
 * @public
 * @deprecated 将在 2.0.0 移除。 改用 ParameterError  */
export const ParametersTypeError = ParameterTypeError;
