import * as fs from "node:fs";

function fstat(fd: number) {
  return new Promise<fs.Stats>(function (resolve, reject) {
    fs.fstat(fd, (err, stats) => (err ? reject(err) : resolve(stats)));
  });
}
