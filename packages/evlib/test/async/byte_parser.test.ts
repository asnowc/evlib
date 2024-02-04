import { LengthByteParser, StepsByteParser } from "evlib/async";
import { expect, describe, test } from "vitest";
describe("LengthByteParser", function () {
  test("未结束执行 finish()", function () {
    const parser = new LengthByteParser(10);
    expect(() => parser.finish()).toThrowError();
  });
  test("无剩余", function () {
    const parser = new LengthByteParser(10);
    expect(parser.next(new Uint8Array(3))).toBeFalsy();
    expect(parser.next(new Uint8Array(3))).toBeFalsy();
    expect(parser.next(new Uint8Array(4))).toBeTruthy();
    const { value, residue } = parser.finish();
    expect(value.byteLength).toBe(10);
    expect(residue).toBeUndefined();
  });
  test("有剩余", function () {
    const parser = new LengthByteParser(6);
    expect(parser.next(new Uint8Array(4))).toBeFalsy();
    expect(parser.next(new Uint8Array(4))).toBeTruthy();
    const { value, residue } = parser.finish();
    expect(value.byteLength).toBe(6);
    expect(residue?.byteLength).toBe(2);
  });
});
describe("StepsByteParser", function () {
  test("", function () {
    const parser = new StepsByteParser({ first: new LengthByteParser(4), final: (data: Uint8Array) => data.join(",") });
    expect(parser.next(new Uint8Array(4))).toBeTruthy();
    expect(parser.finish().value).toBe("0,0,0,0");
  });
});
