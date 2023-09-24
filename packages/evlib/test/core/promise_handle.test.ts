import { PromiseHandle, TimeoutPromise } from "../../src/core/promise_handle.js";
import { describe, it, vi, expect } from "vitest";
describe("PromiseHandle", function () {
    it("成功", async function () {
        let pms = new PromiseHandle<number>();
        const finallyCb = vi.fn();
        pms.finally(finallyCb);
        queueMicrotask(() => pms.resolve(3));
        await expect(pms).resolves.toBe(3);

        expect(finallyCb).toBeCalledTimes(1);
        await expect(pms, "重复then").resolves.toBe(3);
    });
    it("中断", async function () {
        let pms = new PromiseHandle<number, number>();

        const then2Cb = vi.fn();
        pms.then(undefined, then2Cb);
        queueMicrotask(() => pms.reject(3));
        await expect(pms).rejects.toBe(3);

        expect(then2Cb).toBeCalledTimes(1);
        await expect(pms, "重复catch").rejects.toBe(3);
    });
});
describe("TimeoutPromise", function () {
    it("超时成功", async function () {
        let pms = new TimeoutPromise(100);
        await expect(pms).resolves.toBeUndefined();
    });
    it("超时失败", async function () {
        let res = new TimeoutPromise(50, true);
        let val = 0;
        res.then(
            () => (val = 1),
            () => (val = 2)
        );
        await new TimeoutPromise(60);
        expect(val).toEqual(2);
    });
});
