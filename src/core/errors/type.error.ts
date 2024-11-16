/** 创建一个类型错误的描述
 * @public
 */
export function createTypeErrorDesc(expect: string, actual: string): string {
  return `预期: ${expect}, 实际: ${actual}`;
  //return `Expect: ${expect}, actual: ${actual}`;
}

/** @public */
export class TypeError extends Error {
  constructor(public override cause: TypeErrorDesc, msg?: string) {
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
   * @param index - 异常参数的索引 （从 1 开始）
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
  constructor(index: number, expect: string, actual: string, name?: string) {
    super(index, createTypeErrorDesc(expect, actual), name);
  }
}
