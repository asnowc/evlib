import { WithPromise, withPromise } from "../core/mod.js";

type AsyncGenWait<T, N> = WithPromise<T> & {
  nextData: N;
};
type DataLink<T, N> = WithPromise<N> & {
  data: T;
  next?: DataLink<T, N>;
};
/**
 * @alpha
 * @remark 将被动数据转为主动的异步迭代器处理模式
 */
export class PassiveDataCollector<T, R = void, N = void> {
  private last?: DataLink<T, N>;
  private head?: DataLink<T, N>;
  private wait?: AsyncGenWait<T, N>;
  lock = false;
  private closed = false;
  private result?: R;
  /** @remarks 收集同步数据 */
  yield(data: T): Promise<N> {
    if (this.wait) {
      this.wait.resolve(data);
      let nextData = this.wait.nextData;
      this.wait = undefined;
      return Promise.resolve(nextData);
    } else {
      let next: DataLink<T, N> = withPromise({ data });
      if (this.last) this.last.next = next;
      else this.head = next;
      this.last = next;
      return next.promise;
    }
  }
  close(data: R) {
    if (this.closed) return;
    this.closed = true;
    if (this.wait) {
      this.wait.reject(data);
      this.wait = undefined;
    }
    this.result = data;
  }
  /**
   * @remarks 获取异步迭代器, 在异步迭代器关闭前再次调用会抛出异常.
   * @returns 返回这个异步迭代器的 next() 必须按顺序调用. 否则抛出异常 */
  async *getAsyncGen(): AsyncGenerator<T, R, N> {
    if (this.lock) throw new Error("locked");
    this.lock = true;
    let ret: N;
    while (this.head) {
      try {
        ret = yield this.head.data;
        this.head.resolve(ret);
      } catch (error) {
        this.head.reject(error);
      }
      this.head = this.head.next;
    }
    this.last = undefined;
    while (!this.closed) {
      try {
        this.wait = withPromise({ nextData: ret! });
        ret = yield this.wait.promise;
      } catch (r) {
        this.lock = false;
        return r as R;
      }
    }
    this.lock = false;
    return this.result!;
  }
}
