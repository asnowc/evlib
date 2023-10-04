import { expect, it, describe, test, vi } from "vitest";
import {
    readableRead,
    readableReadAll,
    BridgingError,
    PipeOptions,
    PipeSourceError,
    PipeTargetError,
    bridgingDuplex,
    pipeTo,
} from "../../src/stream.js";
import { Duplex, Readable, Writable } from "node:stream";
import { Callback, DuplexOpts, ReadableOpts, WritableOpts } from "./__mocks__/mock_stream.js";
import { afterTime } from "evlib";

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
const chunks = [Buffer.from("abcd"), Buffer.from("efgh"), Buffer.from("ijkl"), Buffer.from("mnop")];
describe("readableRead", function () {
    it("读取成功", async function () {
        const readable = createReadable();
        let p1 = expect(readableRead(readable, 2)).resolves.toEqual(chunks[0].subarray(0, 2));
        let p2 = expect(readableRead(readable, 4).then((buf) => buf.toString())).resolves.toBe("cdef");
        let p3 = expect(readableRead(readable, 2)).resolves.toEqual(chunks[1].subarray(2, 4));

        readable.push(chunks[0]);
        readable.push(chunks[1]);
        readable.push(null);

        await Promise.all([p1, p2, p3]);
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

describe.concurrent("pipeTo", function () {
    describe("resolve", function () {
        test.each([false, true])("默认自动结束 结束可写端: %s", async function (preventWritableEnd) {
            const a = createReadable();
            const b = createWritable();

            setTimeout(() => {
                arrayPush(a, ["1", "2", "3", null]);
            });
            await expect(pipeTo(a, b, { preventWritableEnd })).resolves.toBeUndefined();
            expect(a.readableEnded).toBeTruthy();
            expect(a.closed).toBeTruthy();
            expect(a.destroyed).toBeTruthy();

            expect(b.writable).toBe(preventWritableEnd);

            expect(b.writableFinished).toBe(!preventWritableEnd);
            expect(b.closed).toBe(!preventWritableEnd);
            expect(b.destroyed).toBe(!preventWritableEnd);
        });
    });

    describe("异常", function () {
        describe.each([false, true])("writable 异常 - 阻止Readable销毁: %s", function (preventReadableDispose) {
            test("writable 写入出错", async function () {
                const err = new Error("w err");
                const a = createReadable();
                const b = createWritable({
                    write(a, b, cb) {
                        cb(err);
                    },
                });
                setTimeout(() => {
                    arrayPush(a, ["1", "2", "3"]);
                });
                const res = await pipeTo(a, b, { preventReadableDispose }).catch((e) => e);
                expect(res).instanceof(PipeTargetError);
                expect(res.cause).toBe(err);

                expect(a.readable).toBe(preventReadableDispose);
                expect(a.destroyed).toBe(!preventReadableDispose);

                expect(b.destroyed).toBeTruthy();
            });
            test("writable 已销毁", async function () {
                const err = new Error("w err");
                const a = createReadable();
                const b = await getDestroyedWritable(err);

                const res = await pipeTo(a, b, { preventReadableDispose }).catch((e) => e);
                expect(res).instanceof(PipeTargetError);
                expect(res.cause).toBe(err);

                expect(a.readable).toBe(preventReadableDispose);
                expect(a.destroyed).toBe(!preventReadableDispose);

                expect(b.destroyed).toBeTruthy();
            });
            test("writable 已关闭", async function () {
                const { a, b } = createDoubleDuplex();
                b.end();
                await afterTime();
                expect(b.closed).toBeFalsy();

                const res = await pipeTo(a, b, { preventReadableDispose }).catch((e) => e);
                expect(res).instanceof(PipeTargetError);
                expect(res.cause).toMatchObject({ message: "Writable is ended" });

                expect(a.readable).toBe(preventReadableDispose);
                expect(a.destroyed).toBe(!preventReadableDispose);

                expect(b.closed).toBeFalsy();
            });
        });
        describe.each([false, true])("readable 异常 - 阻止 Writable 销毁: %s", function (preventWritableDispose) {
            test("readable 读取出错", async function () {
                const err = new Error("w err");
                const a = createReadable();
                const b = createWritable();
                setTimeout(() => {
                    a.destroy(err);
                });
                const res = await pipeTo(a, b, { preventWritableDispose }).catch((e) => e);
                expect(res).instanceof(PipeSourceError);
                expect(res.cause).toBe(err);

                expect(a.destroyed).toBeTruthy();

                expect(b.destroyed).toBe(!preventWritableDispose);
            });
            test("readable 已销毁", async function () {
                const err = new Error("w err");
                const a = await getDestroyedReadable(err);
                const b = createWritable();
                if (preventWritableDispose) return;
                const res = await pipeTo(a, b, { preventWritableDispose }).catch((e) => e);
                expect(res).instanceof(PipeSourceError);
                expect(res.cause).toBe(err);

                expect(a.destroyed).toBeTruthy();

                expect(b.writable).toBe(preventWritableDispose);
                expect(b.destroyed).toBe(!preventWritableDispose);
            });
            test("readable 已 ended", async function () {
                const { a, b } = createDoubleDuplex();
                a.push(null);
                a.read();
                await afterTime();

                const res = await pipeTo(a, b, { preventWritableDispose }).catch((e) => e);
                expect(res).instanceof(PipeSourceError);
                expect(res.cause).toMatchObject({ message: "Readable is ended" });

                expect(a.readable).toBeFalsy();

                expect(b.destroyed).toBe(!preventWritableDispose);
            });
        });
        describe("中断", function () {
            test.each([{ preventReadableDispose: true }, { preventWritableDispose: true }] as PipeOptions[])(
                "中断",
                async function (pipeOpts) {
                    const a = createReadable();
                    const b = createWritable();
                    const abc = pipeTo(a, b, pipeOpts);

                    const err = new Error("ab");
                    abc.abort(err);
                    await expect(abc).rejects.toBe(err);

                    expect(a.readable).toBe(!!pipeOpts.preventReadableDispose);
                    expect(b.writable).toBe(!!pipeOpts.preventWritableDispose);
                }
            );
        });
    });
});
describe.concurrent(
    "bridgingDuplex",
    function () {
        test("正常结束", async function () {
            const aData = ["1", "2", "3"];
            const bData = ["a", "b", "c"];
            const aList: string[] = [];
            const bList: string[] = [];
            const { a, b } = createDoubleDuplex(
                {
                    write(c, e, cb) {
                        aList.push(c.toString());
                        cb();
                    },
                },
                {
                    write(c, e, cb) {
                        bList.push(c.toString());
                        cb();
                    },
                }
            );

            const pms = bridgingDuplex(a, b);
            setTimeout(() => {
                arrayPush(a, [...aData, null]);
                arrayPush(b, [...bData, null]);
            });

            await expect(pms).resolves.toEqual({ a, b });
            expect(a.readableEnded).toBeTruthy();
            expect(a.writableFinished).toBeTruthy();

            expect(b.readableEnded).toBeTruthy();
            expect(b.writableFinished).toBeTruthy();

            expect(aList).toEqual(bData);
            expect(bList).toEqual(aData);

            expect(a.closed).toBeTruthy();
            expect(a.destroyed).toBeTruthy();

            expect(b.destroyed).toBeTruthy();
            expect(b.closed).toBeTruthy();
        });
        test.each([false, true])("异常 - preventDispose: %s", async function (preventDispose) {
            const a = createDuplex();
            const b = createDuplex();
            const err = new Error("ks");
            setTimeout(() => {
                b.destroy(err);
            });
            const res = await bridgingDuplex(a, b, { preventDispose }).catch((err) => err);
            expect(res).toBeInstanceOf(BridgingError);
            expect(res.side).toBe(b);
            expect(res.cause).toBe(err);

            expect(b.destroyed).toBeTruthy();
            expect(b.errored).toBe(err);

            expect(a.destroyed).toBe(!preventDispose);
            expect(a.errored ?? null, "error 应该是 b 抛出的 error").toBe(preventDispose ? null : err);
        });
    },
    1000
);

function createReadable(opts?: ReadableOpts) {
    return new Readable({ read() {}, ...opts });
}

function createWritable(opts?: WritableOpts) {
    return new Writable({
        write(c, e, cb) {
            cb();
        },
        ...opts,
    });
}
async function getDestroyedWritable(err?: any) {
    const b = createWritable();
    //销毁前订阅error事件, 避免抛出全局未捕获异常
    const onError = vi.fn();
    b.on("error", onError);
    b.destroy(err);
    await afterTime();
    b.off("error", onError);
    return b;
}
async function getDestroyedReadable(err?: any) {
    const b = createReadable();
    //销毁前订阅error事件, 避免抛出全局未捕获异常
    const onError = vi.fn();
    b.on("error", onError);
    b.destroy(err);
    await afterTime();
    b.off("error", onError);
    return b;
}

function createDuplex(opt1?: DuplexOpts) {
    return new Duplex({
        read() {},
        write(c: any, e: string, cb: Callback) {
            cb(null);
        },
        ...opt1,
    });
}
function createDoubleDuplex(opt1?: DuplexOpts, opt2?: DuplexOpts) {
    function write(c: any, e: string, cb: Callback) {
        cb(null);
    }
    const a = new Duplex({ read() {}, write, ...opt1 });
    const b = new Duplex({ read() {}, write, ...opt2 });
    return { a, b };
}
function arrayPush(duplex: Readable, data: string[] | [...string[], null]) {
    let len = 0;
    return new Promise<void>((resolve, reject) => {
        function push() {
            setTimeout(() => {
                duplex.push(data[len], "utf-8");
                if (++len < data.length) push();
                else resolve();
            }, 20);
        }
        push();
    });
}
