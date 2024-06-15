import { LinkedQueue, LinkedCacheQueue } from "evlib/data_struct";
import { test, describe, expect } from "vitest";
describe("LinkedQueue", function () {
  test("构造", function () {
    const queue = new LinkedQueue();
    const data = [1, 2, 3, 4];
    for (const item of data) {
      queue.push({ data: item });
    }
    expect(queue.size).toBe(4);
    queue.clear();
    expect(queue.size).toBe(0);
    expect(Array.from(queue).length).toBe(0);
  });
  test("push 1-shift 1", function () {
    const queue = new LinkedQueue();
    const item = {};
    queue.push(item);
    expect(queue.head).toBe(item);
    expect(queue.last).toBe(queue.head);
    expect(queue.size).toBe(1);

    queue.shift();

    expect(queue.head).toBeUndefined();
    expect(queue.last).toBeUndefined();
    expect(queue.size).toBe(0);
  });
  test("shift", function () {
    const queue = new LinkedQueue<any>();
    queue.push({});
    queue.push({});
    queue.push({});
    expect(queue.shift().next, "不应存在 next 属性").toBeUndefined();
    queue.shift();
    queue.shift();
    expect(() => queue.shift(), "长度为0，尝试出队会抛出异常").toThrowError();
  });
  test("push多个", function () {
    const queue = new LinkedQueue<TestLink>();
    const items = [{ data: 0 }, { data: 1 }, { data: 2 }, { data: 3 }];
    items.forEach((item) => queue.push(item));
    expect(queue.head).toBe(items[0]);
    expect(queue.last).toBe(items[3]);
    expect(queue.size).toBe(4);

    expect(queueToArr(queue)).toEqual([0, 1, 2, 3]);
  });

  test("unshift", function () {
    const queue = new LinkedQueue<TestLink>();
    queue.push({ data: 0 });
    queue.push({ data: 1 });
    queue.unshift({ data: 2 });

    expect(queue.size).toBe(3);

    expect(queueToArr(queue)).toEqual([2, 0, 1]);
  });
});

describe("LinkedCacheQueue", function () {
  test("maxSize", function () {
    const queue = new LinkedCacheQueue<TestLink>(4);
    queue.push({ data: 1 });
    queue.push({ data: 2 });
    queue.push({ data: 3 });
    queue.push({ data: 4 });
    expect(queue.maxSize).toBe(4);
    expect(queue.size).toBe(4);
    queue.push({ data: 5 });
    expect(queueToArr(queue)).toEqual([2, 3, 4, 5]);

    queue.maxSize = 6;
    expect(queueToArr(queue)).toEqual([2, 3, 4, 5]);

    queue.maxSize = 3;
    expect(queueToArr(queue)).toEqual([3, 4, 5]);

    queue.maxSize = 1;
    expect(queueToArr(queue)).toEqual([5]);

    queue.maxSize = 0;
    expect(queueToArr(queue)).toEqual([]);
  });
  test("无效的 maxSize", function () {
    const queue = new LinkedCacheQueue<TestLink>(0);
    queue.push({ data: 6 });
    expect(queue.size).toBe(0);
    queue.maxSize = -1;
    expect(queue.maxSize).toBe(0);
  });
});
type TestLink = {
  data: number;
  next?: TestLink;
};
function queueToArr(queue: LinkedQueue<TestLink>) {
  return Array.from(queue).map((item) => item.data);
}
