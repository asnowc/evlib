import { promiseHandle } from "../../src/core/promise_handle.js";
import { describe, it, vi, expect } from "vitest";
describe("promiseHandle", function () {
    it("成功", async function () {
        let hd = promiseHandle<number>();
        const finallyCb = vi.fn();
        hd.promise.finally(finallyCb);
        queueMicrotask(() => hd.resolve(3));
        await expect(hd.promise).resolves.toBe(3);

        expect(finallyCb).toBeCalledTimes(1);
        await expect(hd.promise, "重复then").resolves.toBe(3);
    });
    it("中断", async function () {
        let hd = promiseHandle<number>();

        const then2Cb = vi.fn();
        hd.promise.then(undefined, then2Cb);
        queueMicrotask(() => hd.reject(3));
        await expect(hd.promise).rejects.toBe(3);

        expect(then2Cb).toBeCalledTimes(1);
        await expect(hd.promise, "重复catch").rejects.toBe(3);
    });
});
