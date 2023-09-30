//ab_child
const argv = process.env

const fdList = (argv.FD_LIST && JSON.parse(argv.FD_LIST)) ?? []
/** 
 * @type number[]
 */
const resList = fdList.map((fd) => parseInt(fd))

async function openAll() {
    for (const fd of resList) {
        const buf = await read(fd, 10)
        console.log(buf.subarray(0, 10).toString());
        await close(fd)
    }
}

import * as fs from "node:fs";

/** 
 * @returns {Promise<Buffer>}
 */
function read(fd, length) {
    return new Promise(function (resolve, reject) {
        fs.read(fd, { length, }, (err, length, buf) => (err ? reject(err) : resolve(buf)));
    });
}
/**
 * @beta
 * @remark 关闭资源
 */
function close(fd) {
    return new Promise(function (resolve, reject) {
        fs.close(fd, (err) => (err ? reject(err) : resolve()));
    });
}

await openAll() 
console.log("fin");