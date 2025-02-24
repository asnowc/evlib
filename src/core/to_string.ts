/**
 * 格式化输出 error 信息, 递归转换 cause
 * @public
 */
export function toErrorStr(
  err?: any,
  showStack?: boolean,
): string;
export function toErrorStr(
  err?: any,
  showStack_options?: { showStack?: boolean } | boolean,
): string {
  const option = typeof showStack_options === "object" ? showStack_options : { showStack: showStack_options, tab: 0 };

  if (err === null || err === undefined) return String(err);
  if (err instanceof Error) {
    const name = err.constructor.name;
    const code = (err as any).code;
    let str: string;
    if (option.showStack && err.stack) {
      str = err.stack;
    } else {
      str = (err as any).code ? `${name}(${code}): ${err.message}` : `${name}: ${err.message}`;
    }
    if (err.cause !== undefined) {
      return str + "\n  Cause " + toErrorStr(err.cause, option as any);
    }
    return str;
  } else {
    const name = Object.getPrototypeOf(err).constructor?.name ?? typeof err;
    return name + ": " + String(err);
  }
}
