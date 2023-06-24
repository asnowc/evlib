import { it, expect, describe } from "vitest";
import { checkType, checkFx, optional } from "./type_check";
describe("基本", function () {
    describe("基础类型检测", function () {
        it("null", function () {
            expect(checkType(null, "null")).toBeUndefined();
            expect(checkType(null, {})).toBeTypeOf("string");
        });
        it("object", function () {
            expect(checkType({}, "object")).toBeUndefined();
        });
        it("symbol", function () {
            expect(checkType(Symbol(), "symbol")).toBeUndefined();
        });
    });
    describe("检测对象", function () {
        it("基本", function () {
            let obj = { s: 3, i: "s", q: undefined };
            expect(checkType(obj, { s: "number", i: "string", q: "undefined" })).toBeUndefined();
            expect(obj).toEqual({ s: 3, i: "s", q: undefined });
        });
        it("移除多余", function () {
            let obj = { s: 3, i: "s", q: undefined };
            let checkRes = checkType(obj, { s: "number", i: "string" }, { deleteSurplus: true });
            expect(checkRes).toBeUndefined();
            expect(obj).toEqual({ s: 3, i: "s" });
        });
        it("仅匹配", function () {
            let obj = { s: 3, i: "s", q: undefined };
            let checkRes = checkType(obj, { s: "number", i: "string" }, { checkProvidedOnly: true });
            expect(checkRes).toBeUndefined();
            expect(obj).toEqual({ s: 3, i: "s", q: undefined });
        });
        it("多余字段检测", function () {
            let obj = { s: 3, i: "s", q: undefined };
            let checkRes = checkType(obj, { s: "number", i: "string" });
            expect(checkRes).toEqual({ q: "预期类型:不存在, 实际:存在" });
            expect(obj).toEqual({ s: 3, i: "s", q: undefined });
        });
        it("检测所有字段", function () {
            let obj = { s: 3, i: "s", q: undefined };
            let checkRes = checkType(obj, { s: "number", i: "string", q: "number", y: "number" }, { checkAll: true });
            expect(checkRes).has.keys(["q", "y"]);
            expect(obj).toEqual({ s: 3, i: "s", q: undefined });
        });
        it("检测不通过就跳出", function () {
            let obj = { s: 3, i: "s", q: undefined };
            let checkRes = checkType(obj, { s: "number", i: "string", q: "number", y: "number" }, { checkAll: false });
            let checkRes2 = checkType(obj, { s: "number", i: "string", q: "number", y: "number" });
            expect(checkRes).has.keys(["q"]);
            expect(checkRes2).has.keys(["q"]);
            expect(obj).toEqual({ s: 3, i: "s", q: undefined });
        });

        it("使用自定义函数判断", function () {
            let obj = { s: 3, i: "s" };
            expect(checkType(obj, { s: "number", i: (a: any) => "sd" })).has.key("i");
            expect(checkType(obj, { s: "number", i: (a: any) => undefined })).toBeUndefined();
        });
        it("预期类型不一致", function () {
            let obj = { s: 3, y: null, q: undefined };
            expect(
                checkType(obj, { s: "string", y: {}, q: "undefined" }, { checkAll: true }),
                "预期类型不一致"
            ).has.keys(["s", "y"]);
            expect(checkType(obj, { s: "string", y: (a: any) => undefined }), "预期类型不一致").has.keys(["s"]);
        });
        it("预期不存在", function () {
            let res = checkType({ a: 8 }, { a: "number", b: "number" });
            expect(res).has.key("b");
        });
        it("判断null类型", function () {
            let res = checkType({ a: null }, { a: "null" });
            expect(res).toBeUndefined();
        });
        it("传入错误预期类型", function () {
            let res = checkType({ a: 3 }, { a: "D" } as any);
            expect(res).has.key("a");
        });
    });
    describe("元组检测", function () {
        it("全匹配", function () {
            expect(checkType([1, "d"], ["number", "string"])).toBeUndefined();

            let res = checkType([1, "d"], ["number", "number"]);
            expect(res[0]).toBeUndefined();
            expect(res[1]).toBeTypeOf("string");
        });
        it("长度检测", function () {
            let val = [1, "d", null];
            expect(checkType(val, ["number", "string"])).has.key("length");
            expect(val).toEqual([1, "d", null]);
        });
        it("仅匹配预期提供字段", function () {
            let val = [1, "d", null];
            expect(checkType(val, ["number", "string"], { checkProvidedOnly: true })).toBeUndefined();
            expect(val).toEqual([1, "d", null]);
        });
        it("移除多余", function () {
            let val = [1, "d", null];
            expect(checkType(val, ["number", "string"], { deleteSurplus: true })).toBeUndefined();
            expect(val).toEqual([1, "d"]);
        });
    });
});
describe("嵌套", function () {
    it("仅检测", function () {
        let res = checkType({ s: 3, i: { q: "s", c: undefined } }, { s: "number", i: { q: "string", c: "undefined" } });
        expect(res).toBeUndefined();
    });
    it("删除多余", function () {
        let obj = { s: 3, i: { q: "s", y: null, c: undefined }, b: 6 };
        let res = checkType(obj, { s: "number", i: { q: "string", c: "undefined" } }, { deleteSurplus: true });
        expect(res).toBeUndefined();
        expect(obj).toEqual({ s: 3, i: { q: "s", c: undefined } });
    });
});

describe("内置测试函数", function () {
    it("联合类型", function () {
        //联合类型
        expect(
            checkType(
                { s: 3, i: null },
                { s: checkFx.unionType(["number", "string"]), i: checkFx.unionType(["string", (a) => undefined]) }
            )
        ).toBeUndefined();
        expect(checkType({ s: 3 }, { s: checkFx.unionType(["bigint", "string"]) })).has.key("s");
    });
    describe("可选", function () {
        describe("自定义可选", function () {
            it("不存在的可选", function () {
                expect(checkType({ s: 3 }, { s: "number", q: optional("string") })).toBeUndefined();
            });
            it("正确的可选", function () {
                expect(checkType({ s: 3, q: 8 }, { s: "number", q: optional("string") })).has.keys(["q"]);
            });
            it("错误的可选", function () {
                expect(checkType({ s: 3, q: "sd" }, { s: "number", q: optional("string") })).toBeUndefined();
            });
        });
        it("删除值为undefined且预期为可选类型的字段", function () {
            let object = { s: 3, q: undefined };
            expect(checkType(object, { s: "number", q: optional("string") }, { deleteSurplus: true })).toBeUndefined();
            expect(object, "q应该被删除").not.has.key("q");
        });
        it("快捷可选", function () {
            expect(checkType({ s: 3, i: "s" }, { s: "number", i: "string", q: optional.string })).toBeUndefined();
            expect(checkType({ s: 3, i: "s", q: 8 }, { s: "number", i: "string", q: optional.string })).has.keys(["q"]);
            expect(
                checkType({ s: 3, i: "s", q: "sd" }, { s: "number", i: "string", q: optional.string })
            ).toBeUndefined();
        });
    });
    it("数字范围", function () {
        let towToFour = checkFx.numScope(2, 4);
        expect(checkType({ a: 2 }, { a: towToFour })).toBeUndefined();
        expect(checkType({ a: 3 }, { a: towToFour })).toBeUndefined();
        expect(checkType({ a: 4 }, { a: towToFour })).toBeUndefined();
        expect(checkType({ a: 5 }, { a: towToFour })).has.key("a");
        expect(checkType({ a: 1 }, { a: towToFour })).has.key("a");
        expect(checkType({ a: "d" }, { a: towToFour })).has.key("a");
        expect(checkType({ a: undefined }, { a: towToFour })).has.key("a");
        expect(checkType({ a: new Set() }, { a: towToFour })).has.key("a");
    });
    it("实例类型", function () {
        let mapIns = checkFx.instanceof(Map);
        expect(checkType({ a: new Map() }, { a: mapIns })).toBeUndefined();
        expect(checkType({ a: null }, { a: mapIns })).has.key("a");
        expect(checkType({ a: NaN }, { a: mapIns })).has.key("a");
        expect(checkType({ a: undefined }, { a: mapIns })).has.key("a");
        expect(checkType({}, { a: mapIns })).has.key("a");
    });
    describe("数组类型判断", function () {
        it("数组类型判断", function () {
            let res = checkType({ a: [2, 4, 56, 78] }, { a: checkFx.arrayType("number") });
            expect(res).toBeUndefined();

            res = checkType({ a: [2, 4, "d", 78] }, { a: checkFx.arrayType("number") });
            expect(res?.a).has.keys([2]);
        });
        it("数组长度限制", function () {
            let res = checkType({ a: [2, 4, 56, 78] }, { a: checkFx.arrayType("number", 2, true) });
            expect(res).toBeUndefined();

            res = checkType({ a: [2, 4, 56, 78] }, { a: checkFx.arrayType("number", 2, false) });
            expect(res).has.key("a");
            expect(res.a).has.keys(["length"]);

            res = checkType({ a: [2, 4, "d", 78] }, { a: checkFx.arrayType("number", 3, false) });
            expect(res).has.key("a");
            expect(res.a).has.keys([2, "length"]);
        });
    });
});
