export function dePromise<T, R>(val: T | Promise<T>, fn: (val: T) => R) {
  if (val instanceof Promise) return val.then(fn);
  return fn(val);
}
