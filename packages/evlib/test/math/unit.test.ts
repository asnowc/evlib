import { autoUnit, paseExponentNum, ExponentFormat } from "evlib/math";
import { describe, test, expect } from "vitest";
describe("autoUnit", function () {
  describe("byte", function () {
    const KB = 1024;
    const MB = 1024 * KB;
    test("基础解析", function () {
      expect(autoUnit.byte(512)).toBe("512B");
      expect(autoUnit.byte(1024)).toBe("1KB");
      expect(autoUnit.byte(1024 + 512)).toBe("1.5KB");
      expect(autoUnit.byte(-1024)).toBe("-1KB");
    });
    test("解析小数", function () {
      expect(autoUnit.byte(1651.2003780718337)).toBe("1.61KB");
    });
    test("指定小数位数", function () {
      expect(autoUnit.byte(1.25 * MB, 1)).toBe("1.2MB");
    });
    test("指定单位", function () {
      expect(autoUnit.byte(1.5, 2, "MB")).toBe("1.5MB");
    });
  });
});
describe("paseExponentNum", function () {
  test("base", function () {
    expect(paseExponentNum(125, 10)).toEqual({
      decimals: 0.25,
      int: 1,
      exponent: 2,
    } as ExponentFormat);
  });
  test("负数", function () {
    expect(paseExponentNum(-125, 10)).toEqual({
      decimals: 0.25,
      int: -1,
      exponent: 2,
    } as ExponentFormat);
  });
  test("小数", function () {
    expect(paseExponentNum(122.5, 100)).toEqual({
      decimals: 0.225,
      int: 1,
      exponent: 1,
    } as ExponentFormat);
  });
  test("限制指数", function () {
    expect(paseExponentNum(10000, 10, 2)).toEqual({
      decimals: 0,
      int: 100,
      exponent: 2,
    } as ExponentFormat);
  });
  test("动态进位", function () {
    expect(paseExponentNum(10000, [2, 5, 10])).toEqual({
      decimals: 0,
      int: 100,
      exponent: 3,
    } as ExponentFormat);
  });
});
