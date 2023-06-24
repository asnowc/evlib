import { it, describe, expect } from "vitest";
import { InquiryRequest, PromiseHandle, RequestStatus, TimeoutPromise } from "./inquiry_request";

describe("PromiseHandle", function () {
    it("成功", async function () {
        let pms = new PromiseHandle<number>();
        expect(pms).resolves.toEqual(3);
        pms.resolve(3);
        await pms;
        expect(pms).toMatchObject({
            acceptCb: undefined,
            rejectCb: undefined,
        });
    });
    it("中断", async function () {
        let pms = new PromiseHandle<number, number>();
        expect(pms).rejects.toEqual(3);
        pms.reject(3);
        await new TimeoutPromise(10);
        expect(pms).toMatchObject({
            acceptCb: undefined,
            rejectCb: undefined,
        });
    });
    it("中断后继续中断", async function () {
        let pms = new PromiseHandle<number, number>();
        pms.reject(3);
        await new TimeoutPromise(10);
        expect(pms).rejects.toEqual(3);
    });
    describe("静态", function () {
        describe("all", function () {
            it("成功", async function () {
                let list = [PromiseHandle.resolve(), PromiseHandle.resolve(), PromiseHandle.resolve()];
                let pms = PromiseHandle.all(list);
                expect(pms).resolves.toEqual([undefined, undefined, undefined]);
            });
            it("其中一个失败, 则失败", function () {
                let list = [new PromiseHandle(), new PromiseHandle(), PromiseHandle.reject(9), PromiseHandle.reject(8)];
                let pms = PromiseHandle.all(list);
                expect(pms, "结果为第一个失败的值").rejects.toEqual(9);
                expect(list[0].status, "waiting 中的 handle 失败, 且结果为第一个失败的值").toEqual(
                    RequestStatus.waiting
                );
                expect(list[1].status, "waiting 中的 handle 失败, 且结果为第一个失败的值").toEqual(
                    RequestStatus.waiting
                );
            });
            it("其中一个失败, 其余所有 waiting 中的都失败", function () {
                let list = [new PromiseHandle(), new PromiseHandle(), PromiseHandle.reject(9), PromiseHandle.reject(8)];
                let pms = PromiseHandle.all(list, true);
                expect(pms, "结果为第一个失败的值").rejects.toEqual(9);
                expect(list[0], "waiting 中的 handle 失败, 且结果为第一个失败的值").rejects.toEqual(9);
                expect(list[1], "waiting 中的 handle 失败, 且结果为第一个失败的值").rejects.toEqual(9);
            });
            it("列表改变不影响所有失败", function () {
                let list: PromiseHandle<number, number>[] = [
                    new PromiseHandle(),
                    new PromiseHandle(),
                    new PromiseHandle(),
                ];
                let pms = PromiseHandle.all(list, true);
                let one = list.shift()!;
                let tow = list.shift()!;
                list.shift()!.reject(9);

                expect(pms, "结果为第一个失败的值").rejects.toEqual(9);
                expect(one, "waiting 中的 handle 失败, 且结果为第一个失败的值").rejects.toEqual(9);
                expect(tow, "waiting 中的 handle 失败, 且结果为第一个失败的值").rejects.toEqual(9);
            });
        });
    });
});
describe("TimeoutPromise", function () {
    it("超时成功", async function () {
        let pms = new TimeoutPromise(100);
        expect(pms).resolves.toBeUndefined();
        expect(pms).toMatchObject({});
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
