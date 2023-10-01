import { it, describe, expect, vi } from "vitest";
import { InquiryRequest } from "evlib/async";

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
