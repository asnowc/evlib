import { expect } from "vitest";
interface CustomMatchers<R = unknown> {
  checkPass(): R;
  checkFail(errDesc?: any): R;
  checkFailWithField(fields: string[]): R;
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
  checkPass(received: any) {
    if (typeof received !== "object" || received === null) {
      return {
        message() {
          return "预期返回对象，实际返回" + typeof received;
        },
        pass: false,
      };
    }
    if (this.isNot) {
      return {
        pass: received.error === undefined,
        message: () => "预期检测不通过",
        actual: "检测通过",
        expected: "检测不通过",
      };
    } else {
      return {
        pass: received.error === undefined,
        message: () => "预期检测通过",
        actual: received.error,
        expected: "检测通过",
      };
    }
  },
  checkFail(received: { error: any }, expectError) {
    const isResult = withError(received);
    if (isResult) return isResult;
    if (expectError === undefined) return passRes;
    try {
      expect(received.error).toEqual(expectError);
      return passRes;
    } catch (error) {
      return {
        pass: false,
        message: () => `预期检测失败`,
        actual: received.error ?? null,
        expected: expectError,
      };
    }
  },
  checkFailWithField(received: { error: any }, field: string[]) {
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
