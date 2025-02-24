import type { Assertion, AsymmetricMatchersContaining } from "vitest";
import { expect } from "vitest";
interface CustomMatchers<R = unknown> {
  toCheckPass(): R;
  toCheckFail(errDesc?: any): R;
  toCheckFailWithField(fields: string[]): R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
function passMsg() {
  return "pass";
}
const passRes = { pass: true, message: passMsg };
expect.extend({
  toCheckPass(received: any) {
    if (typeof received !== "object" || received === null) {
      return {
        message() {
          return "参数应为对象";
        },
        pass: false,
      };
    }
    if (this.isNot) {
      return {
        pass: received.error === undefined,
        message: () => received.error,
        actual: "预期检测通过",
        expected: received.error,
      };
    } else {
      return {
        pass: received.error === undefined,
        message: () => received.error,
        actual: received.error,
        expected: "预期检测通过",
      };
    }
  },
  toCheckFail(received: { error: any }, expe) {
    const isResult = withError(received);
    if (isResult) return isResult;
    if (expe === undefined) return passRes;
    try {
      expect(received.error).toEqual(expe);
      return passRes;
    } catch (error) {
      return {
        pass: false,
        message: () => `预期检测失败`,
        actual: received.error ?? null,
        expected: expe,
      };
    }
  },
  toCheckFailWithField(received: { error: any }, field: string[]) {
    const isResult = withError(received);
    if (isResult) return isResult;

    const act = Object.keys(received.error);

    try {
      expect(act).toEqual(field);
      return passRes;
    } catch (error) {
      return {
        pass: false,
        message: () => `预期检测失败`,
        actual: act,
        expected: field,
      };
    }
  },
});
function checkRes(res: any) {
  if (res === undefined || (typeof res === "object" && res !== null)) return;
  return {
    pass: false,
    message: () => `应返回 object 类型, 实际${typeof res}`,
    expected: {},
    actual: res,
  };
}
function withError(resv: any) {
  const res = checkRes(resv);
  if (res) return res;
  if (!Object.hasOwn(resv, "error")) {
    return {
      pass: false,
      message: () => `预期不通过检测, 实际通过`,
    };
  }
}
