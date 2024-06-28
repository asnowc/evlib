import {
  eachLinkedList,
  getLinkedListByIndex,
  SinglyLinkList,
} from "evlib/data_struct";
import { expect, describe, test } from "vitest";

describe("eachLinkedList", function () {
  test("迭代遍历", function () {
    let head: SinglyLinkList = { next: { next: { next: {} } } };
    const list = Array.from(eachLinkedList(head));
    expect(list[0]).toBe(head);
    expect(list[1]).toBe(head.next);
    expect(list[3]).toBe(head.next!.next!.next);
  });
  test("迭代空", function () {
    const list = Array.from(eachLinkedList());
    expect(list).toEqual([]);
  });
  test("迭代单个", function () {
    const list = Array.from(eachLinkedList({}));
    expect(list.length).toBe(1);
  });
});
describe("getLinkedListByIndex", function () {
  let head: SinglyLinkList = { next: { next: { next: {} } } };
  const arr = Array.from(eachLinkedList(head));
  test("find", function () {
    expect(getLinkedListByIndex(head, 0)).toBe(head);
    expect(getLinkedListByIndex(head, 1)).toBe(arr[1]);
    expect(getLinkedListByIndex(head, 3)).toBe(arr[3]);
  });
  test("over", function () {
    expect(() => getLinkedListByIndex(head, -1)).toThrowError();
    expect(() => getLinkedListByIndex(head, 4)).toThrowError();
    expect(() => getLinkedListByIndex(head, 5)).toThrowError();
  });
  test("空链", function () {
    expect(() => getLinkedListByIndex(undefined as any, -1)).toThrowError();
  });
});
