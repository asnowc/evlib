import { UniqueKeyMap } from "evlib/data_struct.js";
import { it, describe, expect } from "vitest";
let aa = UniqueKeyMap;
console.log(aa);

describe("UniqueKeyMap", function () {
    describe("申请>读取>更新>删除", function () {
        let map: UniqueKeyMap<string>;
        let firstId: number;
        it("创建堆空间", function () {
            map = new UniqueKeyMap(10);
            expect(map.size, "大小为0").toBe(0);
            expect(map.freeSize, "剩余空间为10").toBe(10);
            expect(map.maxSize, "总空间为10").toBe(10);
            expect(map.freeRange, "指针范围为0").toBe(10);
        });
        it("申请唯一key", function () {
            firstId = map.allowKeySet("a")!;
            expect(firstId, "id为0").toBe(0);
            expect(map).toMatchObject({ size: 1, freeSize: 9 });
            expect(map.freeRange).toBe(9);
        });
        it("获取值", function () {
            expect(map.get(firstId)).toBe("a");
        });
        it("update()更新值", function () {
            expect(map.update(firstId, "b")).toBeTruthy();
            expect(map.get(firstId)).toBe("b");
            expect(map).toMatchObject({ size: 1, freeSize: 9 });
            expect(map.freeRange).toBe(9);
        });
        it("删除内存", function () {
            expect(map.delete(firstId)).toBeTruthy();
            expect(map.size, "大小为0").toBe(0);
            expect(map.freeSize, "剩余空间为10").toBe(10);
            expect(map.maxSize, "总空间为10").toBe(10);
            expect(map.freeRange, "指针范围为0").toBe(10);
        });
    });
    describe("异常情况", function () {
        describe("不正确的创建参数", function () {
            it.each([NaN, Infinity, -1, 0, -999])("%s", function (size) {
                expect(() => new UniqueKeyMap(size)).toThrowError();
            });
        });
        it.each([-1, 11])("设置超过地址范围的值:%i", function (val) {
            let heap = new UniqueKeyMap(10);
            expect(() => heap.set(val, "a")).toThrowError();
        });
        it("内存已满继续申请内存", function () {
            let heap = new UniqueKeyMap(3);
            expect(heap.allowKeySet("a"), "返回id为：0").toBe(0);
            expect(heap.allowKeySet("a"), "返回id为：1").toBe(1);
            expect(heap.allowKeySet("a"), "返回id为：2").toBe(2);
            expect(heap.allowKeySet("a", true)).toBeNull();
            expect(() => heap.allowKeySet("a")).toThrowError();
        });
        it("设置未申请内存", function () {
            let heap = new UniqueKeyMap(3);
            expect(() => heap.set(1, "a")).toThrowError();
        });
    });
    it("clear()", function () {
        const heap = new UniqueKeyMap(5);
        for (let i = 0; i < heap.maxSize; i++) {
            heap.allowKeySet(i);
        }
        heap.delete(3);
        heap.delete(1);
        heap.clear();
        expect(heap.size, "大小为0").toBe(0);
        expect(heap.freeSize, "剩余空间为10").toBe(5);
        expect(heap.maxSize, "总空间为10").toBe(5);
        expect(heap.freeRange, "指针范围为0").toBe(5);
    });
    it("update", function () {
        const heap = new UniqueKeyMap(5);
        heap.allowKeySet("1");
        heap.allowKeySet("2");
        const key = heap.allowKeySet("3")!;

        expect(heap.update(key, "9")).toBeTruthy();
        expect(heap.get(key)).toBe("9");
        expect(heap.update(4, "9")).toBeFalsy();
    });
    it("take", function () {
        const heap = new UniqueKeyMap(5);
        const key = heap.allowKeySet("1")!;
        heap.allowKeySet("2");
        expect(heap.take(key)).toBe("1");
        expect(heap.has(key)).toBeFalsy();
        expect(heap.size).toBe(1);
    });

    describe("指针检测", function () {
        it("满空间", function () {
            const heap = new UniqueKeyMap(5);
            fillHeap(heap);
            expect(heap.startPointer).toBe(0);
            expect(heap.lastPointer).toBe(0);
        });
        //空闲空间已全部申请
        it("遍历碎片空间", function () {
            const heap = new UniqueKeyMap(5);
            fillHeap(heap);

            heap.delete(3);
            expect(heap.allowKeySet("q")).toBe(3);
        });
        it("last指针超过到末端", function () {
            const heap = new UniqueKeyMap(4);
            fillHeap(heap);
            heap.delete(0);
            heap.delete(1);

            expect(heap.allowKeySet(1)).toBe(0);
            expect(heap.startPointer, "startPointer").toBe(2);
            expect(heap.lastPointer, "lastPointer").toBe(1);
        });
        it("start指针超过末端", function () {
            const heap = new UniqueKeyMap<void>(4);
            fillHeap(heap);
            for (let i = 0; i < 3; i++) {
                expect(heap.delete(i)).toBeTruthy();
            }
            heap.allowKeySet(); //0
            heap.allowKeySet(); //1  lastPointer=2

            heap.delete(3);

            expect(heap.lastPointer, "startPointer").toBe(2);
            expect(heap.startPointer, "lastPointer").toBe(0);
        });
    });
    describe("区块检测", function () {
        it("满内存", function () {
            const heap = new UniqueKeyMap(4);
            fillHeap(heap);
            expect(heap.freeRange).toBe(0);
        });
        it("0内存", function () {
            const heap = new UniqueKeyMap(4);
            expect(heap.freeRange).toBe(4);
        });
        it("偏移满内存", function () {
            const heap = new UniqueKeyMap(4);
            fillHeap(heap);
            heap.delete(0);
            heap.allowKeySet(1);
            expect(heap.freeRange).toBe(0);
        });
        it("偏移0内存", function () {
            const heap = new UniqueKeyMap(4);
            heap.allowKeySet(1);
            heap.allowKeySet(2);
            heap.delete(0);
            heap.delete(1);
            expect(heap.freeRange).toBe(4);
        });
    });
    it("唯一性", function () {
        let set = new Set();
        let heap = new UniqueKeyMap(10);
        for (let i = 0; i < heap.maxSize; i++) {
            let id = heap.allowKeySet(i);
            expect(set.has(id), i.toString()).toBeFalsy();
        }
    });
});

function fillHeap(heap: UniqueKeyMap) {
    let max = heap.maxSize;
    for (let i = 0; i < max; i++) heap.allowKeySet(i);
}
