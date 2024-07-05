/** 格式化输出 error 信息, 递归转换 cause
 * @public
 */
export function toErrorStr(err?: any): string {
  if (err === null || err === undefined) return String(err);
  if (err instanceof Error) {
    const name = err.constructor.name;
    const code = (err as any).code;
    const str = (err as any).code
      ? `${name}(${code}): ${err.message}`
      : `${name}: ${err.message}`;
    if (err.cause !== undefined) return str + "\n  " + toErrorStr(err.cause);
    return str;
  } else {
    const name = Object.getPrototypeOf(err).constructor?.name ?? typeof err;
    return name + ": " + String(err);
  }
}
