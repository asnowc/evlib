//ab_child
const env = process.env;
const arg = process.argv.slice(2);

/**
 * @type {number[]}
 */
const fdList = ((env.FD_LIST && JSON.parse(env.FD_LIST)) ?? []).map((fd) =>
  parseInt(fd)
);

async function openAll() {
  for (const fd of fdList) {
    const buf = await read(fd, 10);
    console.log(buf.subarray(0, 10).toString());
    await close(fd);
  }
}

import * as fs from "node:fs";

/**
 * @returns {Promise<Buffer>}
 */
function read(fd, length) {
  return new Promise(function (resolve, reject) {
    fs.read(fd, { length }, (err, length, buf) =>
      err ? reject(err) : resolve(buf)
    );
  });
}
/** 关闭资源
 * @beta
 */
function close(fd) {
  return new Promise(function (resolve, reject) {
    fs.close(fd, (err) => (err ? reject(err) : resolve()));
  });
}

await openAll();
console.log(arg);
console.log("fin");
