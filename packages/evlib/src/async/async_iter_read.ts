import type { PromiseHandle } from "../core/mod.js";

type DataLink<T> = {
  data: T;
  next?: DataLink<T>;
};

/** 数据收集器。可用于基于事件转为异步迭代器
 * @alpha
 * @remark 将被动数据转为主动的异步迭代器处理模式
 */
export class DataCollector<T, R = void> implements AsyncGenerator<T, R, void> {
  #last?: DataLink<T>;
  protected _head?: DataLink<T>;
  protected push(item: DataLink<T>) {
    if (this.#last) this.#last.next = item;
    else this._head = item;
    this.#last = item;
  }

  protected _wait?: PromiseHandle<IteratorResult<T, R>>;
  protected _closed = false;
  protected _result?: R;
  /** 收集数据 */
  yield(data: T) {
    if (this._wait) {
      this._wait.resolve({ done: false, value: data });
      this._wait = undefined;
    } else if (!this._closed) this.push({ data });
  }

  /** 调用后结束迭代器生成 */
  close(data: R) {
    if (this._closed) return;
    this._closed = true;
    if (this._wait) {
      this._wait.resolve({ done: true, value: data });
      this._wait = undefined;
    }
    this._result = data;
  }

  next(): Promise<IteratorResult<T, R>> {
    if (this._head) {
      const item = this._head;
      this._head = item.next;
      return Promise.resolve({ value: item.data, done: false });
    }
    if (this._closed) {
      return Promise.resolve({ done: true, value: this._result! });
    }

    if (this._wait) throw new Error("locked");

    return new Promise<IteratorResult<T, R>>((resolve, reject) => {
      this._wait = { resolve, reject };
    });
  }
  /** 结束迭代 */
  return(value: R): Promise<IteratorResult<T, R>> {
    if (this._closed) value = this._result!;
    return Promise.resolve({ done: true, value });
  }
  throw(e: any): Promise<IteratorResult<T, R>> {
    return this.return(e);
  }
  [Symbol.asyncIterator]() {
    return this;
  }
}
