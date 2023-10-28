import { Readable, Duplex, Writable } from "node:stream";
import { describe, test, vi, Mock, expect } from "vitest";
import { Callback, createDuplex, createReadable, createWritable } from "../../stream/__mocks__/mock_stream.js";

/**
 * @remarks 用于测试 node 流的生命周期
 * readable 周期
 *  construct(cb) >  push null(结束输入) > 读取完毕 >'end' > 'close'
 *
 * write 正常周期
 *  construct(cb) > write > end()> 'fin' > 'close'
 *
 */
export type Stream = Duplex | Readable | Writable;
const data = Buffer.from("abc");
describe("readable", function () {
    describe("construct的影响", function () {
        test("有construct", async function () {
            const construct = vi.fn((cb) => cb());
            const stream = new Readable({ read() {}, construct });
            expect(construct, "异步构造, 初始化未被调用").not.toBeCalled(); //异步构造
            await nextMacroTask();
            expect(construct, "异步构造, 初始化未被调用").toBeCalled(); //异步构造
            expect((stream as any)._readableState.constructed).toBeTruthy();
        });
        test("无construct", function () {
            const stream = new Readable({ read() {} });
            expect((stream as any)._readableState.constructed).toBeTruthy(); //如果没有construct 则constructed默认为true})
        });
        test("构造时发生异常", async function () {
            const err = new Error();
            const stream = new Readable({
                read() {},
                construct() {
                    throw err;
                },
            });
            const onError = vi.fn();
            stream.on("error", onError);
            await nextMacroTask();
            expect(onError).toBeCalledWith(err); // 流发出异常
            expect(stream.destroyed).toBeTruthy(); //受 autoDestroy 影响

            expect((stream as any)._readableState.constructed).toBeTruthy();
        });
    });
    test("正常周期", async function () {
        const {
            stream,
            mockOpts: { read, destroy },
        } = createReadable({ highWaterMark: 100 });
        const onClose = vi.fn();
        stream.on("close", onClose);
        stream.push(data); //length = 3
        expect(stream.readableLength, "push 后长度立即变化").toBe(3);

        expect(read).not.toBeCalled(); //push() 之后异步调用
        await nextMacroTask();
        expect(read).toBeCalled(); //push() 一次后 read 被调用

        stream.push(null);
        expect((stream as any)._readableState.ended, "已经push null").toBeTruthy();
        expect(stream.readableEnded).toBeFalsy();

        const chunk = stream.read();
        expect(chunk).not.toBeNull();

        await nextMacroTask();

        //以下面这些改变需要等待一个宏任务
        expect(stream.readable, "readable不可读").toBeFalsy();
        expect(stream.readableEnded, "readable ended").toBeTruthy();

        //下面这些因为auto destroyed  所以改变
        expect(onClose).toBeCalledTimes(1);
        expect(stream.destroyed, "自动销毁").toBeTruthy();
        expect(stream.closed).toBeTruthy();
        expect(destroy).toBeCalled();
    });
});
describe("writable", function () {
    describe("construct的影响", function () {
        test("有construct", async function () {
            const construct = vi.fn((cb) => cb());
            const stream = new Writable({ write: (_1, _2, cb) => cb(), construct });
            expect(construct, "异步构造, 初始化未被调用").not.toBeCalled(); //异步构造
            await nextMacroTask();
            expect(construct, "异步构造, 初始化未被调用").toBeCalled(); //异步构造
            expect((stream as any)._writableState.constructed).toBeTruthy();
        });
        test("无construct", function () {
            const stream = new Writable({ write: (_1, _2, cb) => cb() });
            expect((stream as any)._writableState.constructed).toBeTruthy(); //如果没有construct 则constructed默认为true})
        });
        test("构造时发生异常", async function () {
            const err = new Error();
            const stream = new Writable({
                write: (_1, _2, cb) => cb(),
                construct() {
                    throw err;
                },
            });
            const onError = vi.fn();
            stream.on("error", onError);
            await nextMacroTask();
            expect(onError).toBeCalledWith(err); // 流发出异常
            expect(stream.destroyed).toBeTruthy(); //受 autoDestroy 影响

            expect((stream as any)._writableState.constructed).toBeTruthy();
        });
    });
    test("正常周期", async function () {
        const {
            stream,
            mockOpts: { write, destroy, final },
        } = createWritable({ highWaterMark: 100 });
        const onClose = vi.fn();
        stream.on("close", onClose);
        stream.write(data); //length = 3
        expect(write).toBeCalled(); //write() 立即调用

        await nextMacroTask();
        // expect(stream.writableLength, "write 后长度立即变化").toBe(3);

        stream.end();
        expect(final).toBeCalled(); //end 后调用
        expect((stream as any)._writableState.ended, "已经end()").toBeTruthy();

        expect(stream.writable, "writable 不可读").toBeFalsy();
        expect(stream.writableEnded, "writable ended").toBeTruthy();

        await nextMacroTask();
        //以下面这些改变需要等待一个宏任务
        //下面这些因为auto destroyed  所以改变
        expect(onClose).toBeCalledTimes(1);
        expect(stream.destroyed, "自动销毁").toBeTruthy();
        expect(stream.closed).toBeTruthy();
        expect(destroy).toBeCalled();
    });
    describe("写入时异常", async function () {
        test("default", async function () {
            const err = new Error("abc");
            const {
                stream,
                mockOpts: { destroy, final },
            } = createWritable({
                write: (c, e, cb) => cb(err),
            });
            const onError = vi.fn();
            stream.on("error", onError);
            const cb = vi.fn();
            stream.write("sdg", cb);
            expect(stream.errored).toBe(err);
            expect(stream.closed).toBeFalsy();
            await nextMacroTask();
            expect(onError).not.toBeCalled(); //? 如果自动销毁, 则不会发出error 事件
            //以下状态需要在 autoDestroy 下才会改变
            expect(destroy).toBeCalled();
            expect(stream.closed).toBeTruthy(); //关闭
            expect(stream.destroyed).toBeTruthy();
            expect(final).not.toBeCalled();
        });
        test("autoDestroy", async function () {
            const err = new Error("abc");
            const {
                stream,
                mockOpts: { destroy, final },
            } = createWritable({
                write: (c, e, cb) => cb(err),
                autoDestroy: false,
            });
            const onError = vi.fn();
            stream.on("error", onError);
            const cb = vi.fn();
            stream.write("sdg", cb);
            expect(stream.errored).toBe(err);
            expect(stream.closed).toBeFalsy();
            await nextMacroTask();
            expect(onError).toBeCalled(); //? 如果不自动销毁, 则发出error 事件

            expect(destroy).not.toBeCalled();
            expect(stream.closed).toBeFalsy(); //关闭
            expect(stream.destroyed).toBeFalsy();
            expect(final).not.toBeCalled();
        });
    });
});
describe("stream", function () {
    const list = [
        { createStream: createReadable, type: "readable" as const },
        { createStream: createWritable, type: "writable" as const },
        { createStream: createDuplex, type: "duplex" as const },
    ];
    test("前提", function () {
        expect(new Duplex()).instanceof(Readable);
    });
    describe.each(list)("$type", function ({ createStream, type }) {
        test("not autoDestroy", async function () {
            const {
                stream,
                mockOpts: { destroy },
            } = createStream({ highWaterMark: 100, autoDestroy: false });
            if (stream instanceof Duplex) {
                stream.push(null);
                stream.read();
                stream.end();
            } else if (stream instanceof Readable) {
                stream.push(null);
                stream.read();
            } else {
                stream.end();
            }
            await nextMacroTask();
            //下面这些因为auto destroyed  所以不改变
            expect(stream.closed).toBeFalsy(); //?如果不设置 autoDestroy, 流不会关闭
            expect(stream.destroyed, "auto destroyed 设置了false").toBeFalsy(); //如果设置了true 这里应该是 true
            expect(destroy).not.toBeCalled();
        });
        describe("手动destroy", async function () {
            test("有error", async function () {
                const {
                    stream,
                    mockOpts: { destroy },
                } = createStream({ highWaterMark: 100 });
                const onError = vi.fn();
                const onClose = vi.fn();
                const onEnd = vi.fn();
                const onFin = vi.fn();
                stream.on("error", onError);
                stream.on("close", onClose);
                stream.on("end", onEnd);
                stream.on("finish", onFin);

                const error = new Error();
                stream.destroy(error);

                expect(stream).not.streamUsable();

                expect(stream.closed).toBeTruthy();
                expect(stream.destroyed).toBeTruthy();
                expect(stream.errored, "errored 应为 destroy 对应的值").toBe(error);
                expect(destroy).toBeCalled();
                await nextMacroTask();
                expect(onClose).toBeCalled(); //?destroy 会触发 closes 事件
                expect(onError).not.toBeCalled(); //?destroy 并不影响 error 事件
                expect(onEnd).not.toBeCalled(); //?destroy 并不影响 end 事件
                expect(onFin).not.toBeCalled(); //?destroy 并不影响 fin 事件
            });

            test("无error", async function () {
                const {
                    stream,
                    mockOpts: { destroy },
                } = createStream({ highWaterMark: 100 });
                const onError = vi.fn();
                stream.on("error", onError);
                stream.destroy();
                expect(stream).not.streamUsable();

                expect(stream.closed).toBeTruthy();
                expect(stream.destroyed).toBeTruthy();
                expect(stream.errored).toBeNull(); //null
                expect(destroy).toBeCalled();
            });
        });
        test("emit error", async function () {
            const { stream } = createStream();

            await nextMacroTask(); //等待构造完成

            stream.on("error", () => {}); //防止抛出全局异常
            const error = new Error();
            stream.emit("error", error); //emit error 不会影响流的关闭
            await nextMacroTask();

            expect(stream).streamUsable(); //? emit error 并不会影响流的状态
            expect(stream.errored).toBe(null);
        });
    });
});

describe("pipe", function () {
    test("正常结束", async function () {
        const { readable, writable, queue } = getStream((_, e, cb) => cb(null));
        readable.pipe(writable);

        readable.push("abc", "utf-8");
        readable.push(null);
        await nextMacroTask();
        expect(queue).toEqual(["pipe", "end", "fin", "unpipe", "re-close", "wr-close"]);
        //? autoDestroy 不会影响 pipe
    });
    test("readable异常", async function () {
        const { readable, writable, queue } = getStream((_, e, cb) => cb(null));
        readable.pipe(writable);

        readable.push("abc", "utf-8");
        const err = new Error("abc");
        readable.destroy(err);
        await nextMacroTask();
        expect(queue).toEqual(["pipe", /* "end" */ "re-error", /*  "fin", "unpipe", */ "re-close" /* "wr-close" */]);
        //? readable 发生异常不会导致 writable 关闭和异常, 也不会触发 unpipe
        //? autoDestroy 不会影响 pipe
        // readable: error -> close
    });
    test("writable异常", async function () {
        const { readable, writable, queue } = getStream((_, e, cb) => cb(null));
        readable.pipe(writable);

        readable.push("abc", "utf-8");
        const err = new Error("abc");
        writable.destroy(err);
        await nextMacroTask();
        expect(queue).toEqual(["pipe", /*  "end", "fin",  */ "unpipe", /*  "re-close", */ "wr-error", "wr-close"]);
        //? writable 发生异常不会导致 readable 关闭和异常, 但会触发 unpipe
        //? autoDestroy 不会影响 pipe
        // writable: unpipe -> error -> close
    });
    test("duplex 正常结束", async function () {
        const a = new Duplex({ read() {}, write: (_, e, cb) => cb(null) });
        const b = new Duplex({ read() {}, write: (_, e, cb) => cb(null) });
        const queue = addQueue(a, b);

        a.pipe(b);
        a.push("abc", "utf-8");
        a.push(null);
        await nextMacroTask();
        expect(queue).toEqual(["pipe", "end", "fin", "unpipe"]);
    });
    test("duplex 互导", async function () {
        const a = new Duplex({ read() {}, write: (_, e, cb) => cb(null) });
        const b = new Duplex({ read() {}, write: (_, e, cb) => cb(null) });
        const queue1 = addQueue(a, b);
        const queue2 = addQueue(b, a);
        a.pipe(b);
        b.pipe(a);

        a.push("abc", "utf-8");
        a.push(null);
        await nextMacroTask();
        b.push("q", "utf-8");
        b.push(null);
        await nextMacroTask();
        expect(queue1).toEqual(["pipe", "end", "fin", "unpipe", "wr-close", "re-close"]);
        expect(queue2).toEqual(["pipe", "end", "fin", "unpipe", "re-close", "wr-close"]);
    });
    function cerateEventFn(name: string, queue: string[]) {
        return (e: any) => queue.push(name);
    }
    function addQueue(readable: Readable, writable: Writable) {
        const queue: string[] = [];
        const onEnd = cerateEventFn("end", queue);
        const onFin = cerateEventFn("fin", queue);
        const onReError = cerateEventFn("re-error", queue);
        const onWrError = cerateEventFn("wr-error", queue);
        const onReClose = cerateEventFn("re-close", queue);
        const onWrClose = cerateEventFn("wr-close", queue);
        const onPipe = cerateEventFn("pipe", queue);
        const onUnpipe = cerateEventFn("unpipe", queue);
        readable.on("error", onReError);
        readable.on("close", onReClose);
        readable.on("end", onEnd);

        writable.on("error", onWrError);
        writable.on("close", onWrClose);
        writable.on("finish", onFin);

        writable.on("pipe", onPipe);
        writable.on("unpipe", onUnpipe);

        return queue;
    }
    function getStream(write: (chunk: any, enc: string, cb: Callback) => void, autoDestroy?: boolean) {
        const readable = new Readable({ read() {}, autoDestroy });
        const writable = new Writable({ write, autoDestroy });
        return { writable, readable, queue: addQueue(readable, writable) };
    }
});

function nextMacroTask(time?: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

interface CustomMatchers<R = unknown> {
    /**
     * 预期 readableEnded === true
     * 预期 writableEnded === true
     */
    streamEnded(): R;
    streamConstruct(): R;
    /**
     * 预期 Readable.readable === false
     * 预期 Writable.writable === false
     */
    streamUsable(): R;
}

declare module "vitest" {
    interface Assertion<T = any> extends CustomMatchers<T> {}
    interface AsymmetricMatchersContaining extends CustomMatchers {}
}
expect.extend({
    streamEnded(received: Stream) {
        const expected = !this.isNot;
        if (received instanceof Duplex) {
            return {
                pass: received.readableEnded && received.writableEnded,
                message: () => `预期 readableEnded 和 writableEnded 都为 ${expected}`,
                actual: `readable: ${received.readableEnded} and writable: ${received.writableEnded}`,
                expected: `readable: ${expected} and writable: ${expected}`,
            };
        } else if (received instanceof Readable) {
            return {
                pass: received.readableEnded,
                message: () => `预期 Readable.ended === ${expected}`,
                actual: received.readableEnded,
                expected,
            };
        } else {
            return {
                pass: received.writableEnded,
                message: () => `预期 Writable.ended === ${expected}`,
                actual: received.writableEnded,
                expected,
            };
        }
    },
    streamConstruct(received: Stream) {
        const expected = !this.isNot;
        const r_constructed = (received as any)._readableState?.constructed;
        const w_constructed = (received as any)._writableState?.constructed;
        const message = () => `预期流${this.isNot ? "没有" : ""}构造完毕`;
        if (received instanceof Duplex) {
            return {
                pass: r_constructed && w_constructed,
                message,
                actual: `readable: ${r_constructed} and writable: ${w_constructed}`,
                expected: `readable: ${expected} and writable: ${expected}`,
            };
        } else if (received instanceof Readable) {
            return {
                pass: r_constructed,
                message,
                actual: r_constructed,
                expected,
            };
        } else {
            return {
                pass: w_constructed,
                message,
                actual: w_constructed,
                expected,
            };
        }
    },
    streamUsable(received: Stream) {
        const expected = !this.isNot;
        if (received instanceof Duplex) {
            return {
                pass: received.readable && received.writable,
                message: () => `预期 Duplex 的 readable 和 writable 都为 ${expected}`,
                expected: `readable: ${expected} and writable: ${expected}`,
                actual: `readable: ${received.readable} and writable: ${received.writable}`,
            };
        } else if (received instanceof Readable) {
            return {
                pass: received.readable,
                message: () => `预期 Readable.readable === ${expected}`,
                expected,
                actual: received.readable,
            };
        } else {
            return {
                pass: received.writable,
                message: () => `预期 Writable.writable === ${expected}`,
                expected,
                actual: received.writable,
            };
        }
    },
});
