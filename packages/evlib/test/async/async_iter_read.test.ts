import { PassiveDataCollector } from "evlib/async";
import { describe, test, expect } from "vitest";

describe("PassiveDataCollector", function () {
  test("迭代被动解决", async function () {
    const collector = new PassiveDataCollector<number, number>();
    const gen = collector.getAsyncGen();
    setTimeout(() => collector.yield(4));
    await expect(getGen(gen.next())).resolves.toBe(4);
    setTimeout(() => collector.yield(3));
    await expect(getGen(gen.next())).resolves.toBe(3);
    setTimeout(() => collector.close(0));
    await expect(getGen(gen.next())).resolves.toBe(0);
  });

  test("缓存", async function () {
    const collector = new PassiveDataCollector<number, number>();
    const gen = collector.getAsyncGen();
    collector.yield(4);
    collector.yield(3);
    collector.close(0);
    await expect(getGen(gen.next())).resolves.toBe(4);
    await expect(getGen(gen.next())).resolves.toBe(3);
    await expect(getGen(gen.next())).resolves.toBe(0);
  });
});
function getGen<T, R>(pms: Promise<IteratorResult<T, R>>) {
  return pms.then((val) => val.value);
}
