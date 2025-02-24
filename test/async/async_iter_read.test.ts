import { DataCollector } from "evlib/async";
import { describe, expect, test } from "vitest";

describe("DataCollector", function () {
  test("迭代被动解决", async function () {
    const collector = new DataCollector<number, number>();
    setTimeout(() => {
      collector.yield(4);
      collector.yield(3);
      collector.yield(2);
    });
    await expect(getGen(collector.next())).resolves.toBe(4);
    await expect(getGen(collector.next())).resolves.toBe(3);
    await expect(getGen(collector.next())).resolves.toBe(2);
    setTimeout(() => {
      collector.yield(4);
      setTimeout(() => collector.close(0));
    });
    await expect(getGen(collector.next())).resolves.toBe(4);
    await expect(getGen(collector.next())).resolves.toBe(0);
  });
  test("缓存", async function () {
    const collector = new DataCollector<number, number>();
    collector.yield(4);
    collector.yield(3); //此时缓存两个
    await expect(getGen(collector.next())).resolves.toBe(4);
    await expect(getGen(collector.next())).resolves.toBe(3);
    collector.yield(0);
    collector.yield(1);

    await expect(getGen(collector.next())).resolves.toEqual(0);
    setTimeout(() => collector.close(99));
    await expect(getGen(collector.next())).resolves.toEqual(1);
    await expect(collector.next()).resolves.toEqual({ done: true, value: 99 });
  });
  test("for await", async function () {
    const collector = new DataCollector<number, number>();
    let count = 3;
    setInterval(() => {
      if (count > 0) collector.yield(count--);
      else collector.close(0);
    }, 10);
    let list: number[] = [];
    for await (const value of collector) {
      list.push(value);
    }
    expect(list).toEqual([3, 2, 1]);
  });
  test("for await + 缓存", async function () {
    const collector = new DataCollector<number, number>();
    collector.yield(4);
    collector.yield(3);
    collector.yield(2);
    collector.close(0);
    let list: number[] = [];
    for await (const value of collector) {
      list.push(value);
    }
    expect(list).toEqual([4, 3, 2]);
  });
}, 500);
function getGen<T, R>(pms: Promise<IteratorResult<T, R>>) {
  return pms.then((val) => val.value);
}
