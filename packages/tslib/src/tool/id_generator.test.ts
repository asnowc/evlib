import { IdGeneratorMap, IdGeneratorSet } from "./id_generator";
import { vi, describe, it, expect } from "vitest";

describe("IdGeneratorMap", function () {
    it("next", function () {
        let map = new IdGeneratorMap(2, 0, 3);
        expect(map.next({}), "0").toEqual(0);
        expect(map.next({}), "1").toEqual(1);
        expect(map.next({}), "2").toEqual(2);
        expect(map.next({}), "3").toEqual(3);
        expect(() => map.next({}), "err").toThrowError();
        map.delete(1);
        expect(map.next({})).toEqual(1);
    });
    it("delete", function () {
        let map = new IdGeneratorMap(2, 0, 3);
        map.next(11);
        map.next(22);
        map.next(33);
        expect(map.delete(2), "1").toBeTruthy();
        expect(map.delete(8), "2").toBeFalsy();
        expect(map.next(66), "3").toEqual(2);
    });
    it("clear", function () {
        let map = new IdGeneratorMap(2, 0, 4);
        map.next(11);
        map.next(22);
        map.next(33);
        map.delete(2);
        map.delete(0);
        expect(map, "1").toMatchObject({ id: 3, revokeIds: { size: 2 } });
        map.clear();
        expect(map, "2").toMatchObject({ id: 0, revokeIds: { size: 0 } });
    });
    it("set", function () {
        let map = new IdGeneratorMap<string>(2, 0, 3);
        map.next("11");
        map.next("22");
        map.next("33");
        map.set(2, "set2");
        expect(map.get(2)).toEqual("set2");
        map.delete(1);
        map.set(1, "del1");
        expect(map.get(1)).toEqual("del1");
        expect(map.next("aa")).toEqual(3);
        map.set(44, "44");
        expect(map.get(44), "设置超过范围的id").toBeUndefined();
    });
    it("take", function () {
        let map = new IdGeneratorMap<string>(2, 0, 3);
        map.next("11");
        map.next("22");
        map.next("33");
        expect(map.take(1)).toEqual("22");
        expect(map).toMatchObject({ id: 3, revokeIds: { size: 1 }, size: 2 });
        expect(map.next("44")).toEqual(1);
    });
});
describe("IdGeneratorSet", function () {
    it("next", function () {
        let map = new IdGeneratorSet(2, 0, 3);
        expect(map.next(), "0").toEqual(0);
        expect(map.next(), "1").toEqual(1);
        expect(map.next(), "2").toEqual(2);
        expect(map.next(), "3").toEqual(3);
        expect(() => map.next(), "err").toThrowError();
        map.delete(1);
        expect(map.next()).toEqual(1);
    });
    it("delete", function () {
        let map = new IdGeneratorSet(2, 0, 3);
        map.next();
        map.next();
        map.next();
        expect(map.delete(2), "1").toBeTruthy();
        expect(map.delete(8), "2").toBeFalsy();
        expect(map.next(), "3").toEqual(2);
    });
    it("clear", function () {
        let map = new IdGeneratorSet(2, 0, 4);
        map.next();
        map.next();
        map.next();
        map.delete(2);
        map.delete(0);
        expect(map, "1").toMatchObject({ id: 3, revokeIds: { size: 2 } });
        map.clear();
        expect(map, "2").toMatchObject({ id: 0, revokeIds: { size: 0 } });
    });
    it("add", function () {
        let map = new IdGeneratorSet(2, 0, 3);
        map.next();
        map.next();
        map.next();
        map.add(2);
        map.add(2);
        map.delete(1);
        map.add(1);
        map.add(1);
        expect(map.next()).toEqual(3);
        map.add(44);
        expect(map.has(44), "设置超过范围的id").toBeFalsy();
    });
});
