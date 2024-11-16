import { PromiseConcurrency } from "evlib/async";
import { afterTime, withPromise } from "evlib";
import { expect, test } from "vitest";

test("concurrency", async function () {
    const ctrl = new PromiseConcurrency({ concurrency: 3 });
    const cases = [1, 2, 3, 4].map(() => withPromise<void>());

    await ctrl.push(cases[0].promise);
    expect(ctrl.processingCount).toBe(1);
    await ctrl.push(cases[1].promise);
    expect(ctrl.processingCount).toBe(2);

    let callTimeout = false;

    const p = ctrl.push(cases[2].promise);
    expect(ctrl.processingCount).toBe(3);
    expect(ctrl.processingCount).toBe(3);

    setTimeout(() => {
        cases[1].resolve();
        cases[0].resolve();
        callTimeout = true;
    });
    await p;
    expect(ctrl.processingCount).toBe(1);

    expect(callTimeout).toBeTruthy();
});
test("failed", async function () {
    const ctrl = new PromiseConcurrency({ concurrency: 3, maxFailed: 1 });
    const cases = [1, 2, 3, 4, 5].map(() => withPromise<void>());

    await ctrl.push(cases[0].promise);
    await ctrl.push(cases[1].promise);
    setTimeout(() => {
        cases[1].reject("出错");
    });
    await ctrl.push(cases[2].promise);
    expect(ctrl.processingCount, "1 出错，剩余 0, 2").toBe(2);

    setTimeout(() => {
        cases[2].reject("出错");
    });
    const p = ctrl.push(cases[3].promise);

    expect(ctrl.failedTotal).toBe(1);
    await expect(p).rejects.toThrowError();
    expect(ctrl.processingCount, "2 出错，剩余 0, 3").toBe(2);

    cases[0].resolve();
    cases[3].resolve();
    await ctrl.onClear();


    setTimeout(() => {
        cases[4].resolve();
    });
    await expect(ctrl.push(cases[4].promise)).rejects.toThrowError();
});
test("push many", async function () {
    const ctrl = new PromiseConcurrency({ concurrency: 3, maxFailed: 1 });
    const success = [1, 1, 1, 1].map((s) =>
        s ? Promise.resolve() : Promise.reject()
    );
    await ctrl.push(...success);
    expect(ctrl.processingCount).toBe(0);
    await ctrl.push(...success);
    expect(ctrl.processingCount).toBe(0);
});
test("break one", async function () {
    const ctrl = new PromiseConcurrency({ concurrency: 2, maxFailed: 0 });

    let i = 0;
    for (; i < 12; i++) {
        try {
            if (i === 3) await ctrl.push(Promise.reject());
            else await ctrl.push(afterTime());
        } catch (error) {
            break;
        }
    }

    expect(i).toBe(3);
});
test("onClear", async function () {
    const ctrl = new PromiseConcurrency({ concurrency: 2, maxFailed: 0 });
    let p = 0;
    for (let i = 0; i < 5; i++) {
        ctrl.push(afterTime().then(() => p++));
    }
    await ctrl.onClear();
    expect(p).toBe(5);
});
test("onClearEmpty", async function () {
    const ctrl = new PromiseConcurrency({ concurrency: 2, maxFailed: 0 });
    expect(ctrl.onClear()).resolves.toBeUndefined();
});
