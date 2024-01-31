import { PassiveDataCollector } from "evlib/async";
import { describe, test, expect } from "vitest";

describe("PassiveDataCollector", function () {
  test("迭代被动解决", async function () {
    const collector = new PassiveDataCollector<number, number>();
    const gen = collector.getAsyncGen();
    setTimeout(() => {
      collector.yield(4);
      collector.yield(3);
      collector.yield(2);
    });
    await expect(getGen(gen.next())).resolves.toBe(4);
    await expect(getGen(gen.next())).resolves.toBe(3);
    await expect(getGen(gen.next())).resolves.toBe(2);
    setTimeout(() => {
      collector.yield(4);
      setTimeout(() => collector.close(0));
    });
    await expect(getGen(gen.next())).resolves.toBe(4);
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
  test("for await", async function () {
    const collector = new PassiveDataCollector<number, number>();
    let count = 3;
    setInterval(() => {
      if (count > 0) collector.yield(count--);
      else collector.close(0);
    }, 10);
    let list: number[] = [];
    for await (const value of collector.getAsyncGen()) {
      list.push(value);
    }
    expect(list).toEqual([3, 2, 1]);
  });
  test("for await + 缓存", async function () {
    const collector = new PassiveDataCollector<number, number>();
    collector.yield(4);
    collector.yield(3);
    collector.yield(2);
    collector.close(0);
    let list: number[] = [];
    for await (const value of collector.getAsyncGen()) {
      list.push(value);
    }
    expect(list).toEqual([4, 3, 2]);
  });
}, 500);
function getGen<T, R>(pms: Promise<IteratorResult<T, R>>) {
  return pms.then((val) => val.value);
}
