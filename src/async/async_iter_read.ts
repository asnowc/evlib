import type { PromiseHandle } from "../core/mod.ts";

type DataLink<T> = {
  data: T;
  next?: DataLink<T>;
};

/** 数据收集器。可用于基于事件转为异步迭代器
 * @public
 * @remarks 将被动数据转为主动的异步迭代器处理模式
 */
export class DataCollector<T, R = void> {
  #last?: DataLink<T>;
  #head?: DataLink<T>;
  #push(item: DataLink<T>) {
    if (this.#last) this.#last.next = item;
    else this.#head = item;
    this.#last = item;
  }

  #wait?: PromiseHandle<IteratorResult<T, R>>;
  #closed = false;
  #result?: R;
  /** 收集数据 */
  yield(data: T) {
    if (this.#wait) {
      this.#wait.resolve({ done: false, value: data });
      this.#wait = undefined;
    } else if (!this.#closed) this.#push({ data });
  }

  /** 调用后结束迭代器生成 */
  close(data: R) {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#wait) {
      this.#wait.resolve({ done: true, value: data });
      this.#wait = undefined;
    }
    this.#result = data;
  }

  next(): Promise<IteratorResult<T, R>> {
    if (this.#head) {
      const item = this.#head;
      this.#head = item.next;
      if (!this.#head) this.#last = undefined;
      return Promise.resolve({ value: item.data, done: false });
    }
    if (this.#closed) {
      return Promise.resolve({ done: true, value: this.#result! });
    }

    if (this.#wait) throw new Error("locked");

    return new Promise<IteratorResult<T, R>>((resolve, reject) => {
      this.#wait = { resolve, reject };
    });
  }
  /** 结束迭代 */
  return(value: R): Promise<IteratorResult<T, R>> {
    if (this.#closed) value = this.#result!;
    return Promise.resolve({ done: true, value });
  }
  throw(e: any): Promise<IteratorResult<T, R>> {
    return this.return(e);
  }
  [Symbol.asyncIterator](): AsyncGenerator<T, R, undefined> {
    return this;
  }
}
