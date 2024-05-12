import * as fs from "node:fs";

/** @public */
export { closeSync } from "node:fs";
/** 关闭资源
 * @public
 */
export function close(fd: number) {
  return new Promise<void>(function (resolve, reject) {
    fs.close(fd, (err) => (err ? reject(err) : resolve()));
  });
}
