import { it, describe, expect, vi } from "vitest";
import { InquiryRequest, PromiseHandle, TimeoutPromise } from "evlib/async.js";

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
describe("InquiryRequest", function () {
    it("接受", function () {
        const acceptFn = vi.fn((data: string) => 1);
        const rejectFn = vi.fn((data: string) => 2);
        let inquiry = new InquiryRequest(acceptFn, rejectFn);
        const res = inquiry.accept("arg");
        expect(res, "接受-结果").toBe(1);
        expect(acceptFn.mock.calls[0]).toEqual(["arg"]);
        expect(rejectFn).not.toBeCalled();
    });
    it("拒绝", function () {
        const acceptFn = vi.fn((data: string) => 1);
        const rejectFn = vi.fn((data: string) => 2);
        let inquiry = new InquiryRequest(acceptFn, rejectFn);
        const res = inquiry.reject("arg");
        expect(res, "拒绝-结果").toBe(2);
        expect(rejectFn.mock.calls[0]).toEqual(["arg"]);
        expect(acceptFn).not.toBeCalled();
    });
    it("拒绝后修改状态", function () {
        let inquiry = new InquiryRequest(vi.fn(), vi.fn());
        inquiry.reject("arg");

        expect(inquiry.status).toBeFalsy();
        expect(() => inquiry.accept()).toThrow();
        expect(() => inquiry.reject()).toThrow();
    });
    it("接受后修改状态", function () {
        let inquiry = new InquiryRequest(vi.fn(), vi.fn());
        inquiry.accept("arg");

        expect(inquiry.status).toBeTruthy();
        expect(() => inquiry.accept()).toThrow();
        expect(() => inquiry.reject()).toThrow();
    });
});
