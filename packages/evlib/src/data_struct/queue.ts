import {
  SinglyLinkList,
  eachLinkedList,
  getLinkedListByIndex,
} from "./linked_list.ts";

/** @public */
export interface Queue<T> {
  /** 队头 */
  head?: T;
  /** 入队 */
  push(data: T): void;
  /** 出队 */
  shift(): T;
}

/**
 * 缓存队列。如果push后队列长度超过指定长度，队头会被挤出
 * @public
 */
export interface CacheQueue<T> extends Queue<T> {
  /** 队列大小 */
  size: number;
  /** 队列最大上限  */
  maxSize: number;
}

/**
 * 链表队列
 * @typeParam T - 它不应包含 next 属性，否则在入队后会被覆盖
 * @public
 */
export class LinkedQueue<T extends object> {
  constructor() {}
  last?: SinglyLinkList<T>;
  head?: SinglyLinkList<T>;
  size: number = 0;

  push(data: T) {
    if (this.last) this.last.next = data;
    else this.head = data;
    this.last = data;
    this.size++;
  }
  unshift(data: T): void;
  unshift(data: SinglyLinkList<T>) {
    if (!this.head) this.last = data;
    data.next = this.head;
    this.head = data;
    this.size++;
  }

  /** 出队，返回队头。你需要确保队头存在，否则抛出异常 */
  shift(): T {
    const head = this.head!;
    this.head = head.next;
    if (!head.next) this.last = undefined;
    this.size--;
    return head;
  }
  [Symbol.iterator]() {
    return eachLinkedList(this.head);
  }
}

/**
 * 链式缓存队列。如果push后队列长度超过指定长度，队头会被挤出
 * @public
 */
export class LinkedCacheQueue<T extends object> extends LinkedQueue<T> {
  constructor(maxSize: number) {
    super();
    this.#maxSize = maxSize;
  }
  #maxSize: number;
  get maxSize() {
    return this.#maxSize;
  }
  set maxSize(maxSize: number) {
    if (maxSize < 0) maxSize = 0;
    if (maxSize === 0) {
      this.head = undefined;
      this.last = undefined;
    } else if (maxSize === 1) {
      this.head = this.last;
    } else if (maxSize < this.size) {
      this.head = getLinkedListByIndex(this.head!, this.size - maxSize);
    }
    this.#maxSize = maxSize;
  }
  push(data: T): void {
    if (this.#maxSize <= 0) return;
    else if (this.#maxSize === 1) {
      this.head = data;
      this.last = data;
    }
    super.push(data);
    if (this.size > this.#maxSize) this.shift();
  }
}
