import { Stats } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import * as path from "node:path";

/**
 * @public
 * @remarks 获取一个文件夹中的所有文件的绝对路径
 */
export async function getDirFiles(dir: string): Promise<string[]> {
  const dirInfo = await readdir(dir);
  let pms: Promise<undefined | void | string>[] = [];

  function filterFile(info: Stats, dir: string) {
    return info.isFile() ? dir : undefined;
  }
  for (const name of dirInfo) {
    const filePath = path.resolve(dir, name);
    pms.push(
      stat(filePath).then(
        (info) => filterFile(info, filePath),
        (e) => console.error(e),
      ),
    );
  }
  return Promise.all(pms).then(
    (list): string[] => list.filter((val) => typeof val === "string") as any,
  );
}
