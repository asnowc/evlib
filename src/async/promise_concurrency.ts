import { WithPromise, withPromise } from "../core/promise.ts";

/** @public */
export interface PromiseConcurrencyOption {
  /** 允许错误的数量阈值 */
  maxFailed?: number;
  /** 并发数量 */
  concurrency: number;
}

/**
 * Promise 并发控制
 * @public
 */
export class PromiseConcurrency {
  constructor(config: PromiseConcurrencyOption) {
    const { maxFailed = 0 } = config;
    this.maxFailed = maxFailed;
    this.concurrency = config.concurrency;
  }
  /** 允许的最大并发数量 */
  concurrency: number;
  /** 允许失败的最大数量 */
  maxFailed: number;

  /** 处理中的数量 */
  processingCount = 0;
  /** 累计失败数量 */
  failedTotal = 0;

  #full?: WithPromise<void>;
  /**
   * 将一组 Promise 推送到并发队列，返回 Promise 在并发队列有空余时解决
   * 如果在触发空余前错误数量达到设定阈值，则 Promise 会被拒绝
   */
  async push(...data: Promise<void | any>[]): Promise<void> {
    for (let i = 0; i < data.length; i++) {
      this.processingCount++;
      data[i].then(this.#onTaskSuccess, this.#onError);
    }

    if (this.concurrency <= this.processingCount) {
      this.#full = Promise.withResolvers<void>();
      return this.#full.promise;
    }
  }
  #end?: WithPromise<void>;
  /** 监听一次队列清空事件 */
  onClear(): Promise<void> {
    if (!this.#end) {
      this.#end = withPromise();
      if (this.processingCount === 0) this.#end.resolve();
    }
    return this.#end.promise;
  }
  #onError = (e: any) => {
    this.failedTotal++;
    this.#final(e);
  };
  #onTaskSuccess = (data: unknown) => {
    this.#final();
  };
  #final(e?: any) {
    this.processingCount--;
    if (this.#full) {
      if (this.failedTotal > this.maxFailed) {
        this.#full.reject(
          new Error(`超过错误数量阈值${this.failedTotal}/${this.maxFailed}`, {
            cause: e,
          }),
        );
        this.#full = undefined;
      } else if (this.processingCount <= this.concurrency) {
        this.#full.resolve();
        this.#full = undefined;
      }
    }
    if (this.#end && this.processingCount === 0) {
      this.#end.resolve();
      this.#end = undefined;
    }
  }
}
