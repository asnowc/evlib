import { expect, it, describe, test, vi } from "vitest";
import { Readable, Duplex } from "node:stream";
import { readableRead, readableReadAll } from "../../src/stream.js";

class TestRead extends Readable {
    clear?: NodeJS.Timer;
    count = 0;
    constructor(start?: Buffer) {
        super();
        if (start) this.push(start);
    }
    _read(size: number): void {}
    destroy(error?: Error | undefined): this {
        this.fin();
        super.destroy(error);
        return this;
    }
    interval(speed: number, count: number, size = 1) {
        this.clear = setInterval(() => {
            this.push((this.count % 10).toString().repeat(size));
            if (++this.count >= count) {
                this.fin();
            }
        }, speed);
    }
    fin() {
        clearInterval(this.clear as any);
        this.push(null);
    }
}
describe("readableRead", function () {
    it("读取成功", async function () {
        const readable = new TestRead();
        readable.interval(50, 20, 5);
        await expect(readableRead(readable, 15).then((data) => data.toString("utf-8"))).resolves.toEqual(
            "000001111122222"
        );
        expect(readable.listenerCount("readable")).toBe(0);
    });

    it("流结束", async function () {
        const readable = new TestRead();
        readable.interval(50, 5, 5);
        await expect(readableRead(readable, 40)).rejects.toBeInstanceOf(Error);
        expect(readable.listenerCount("readable")).toBe(0);
    });
    it("中断", async function () {
        const readable = new TestRead();
        const abc = new AbortController();
        readable.interval(100, 20, 5);
        setTimeout(() => {
            abc.abort();
        }, 200);
        await expect(readableRead(readable, 1500, abc.signal)).rejects.toBeInstanceOf(Error);
        expect(readable.listenerCount("readable")).toBe(0);
    }, 500);
    it("初始足够", async function () {
        const readable = new TestRead(Buffer.from("000001111122222"));
        readable.on("readable", () => {});

        await new Promise(function (resolve, reject) {
            setTimeout(resolve, 10);
        });

        await expect(readableRead(readable, 15).then((data) => data.toString("utf-8"))).resolves.toEqual(
            "000001111122222"
        );
        expect(readable.listenerCount("readable")).toBe(1);
    });
});
