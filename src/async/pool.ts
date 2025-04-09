import { setTimeout } from "../core/internal.ts";

/** @public */
export interface ResourceManager<T> {
  create(): Promise<T>;
  dispose(conn: T): void;
}
type PoolConnState = { isFree: boolean; useTotal: number };
/**
 * 资源池，可以用于实现连接池
 * @public
 */
export class ResourcePool<T> {
  static defaultMaxCount = 3;
  #pool = new Map<T | Promise<T>, PoolConnState>();
  #free: { conn: T; date: number }[] = [];
  constructor(
    handler: ResourceManager<T>,
    option: PoolOption = {},
  ) {
    this.#handler = handler;
    this.maxCount = option.maxCount ?? ResourcePool.defaultMaxCount;
    this.freeTimeout = option.idleTimeout ?? 0;
    this.usageLimit = option.usageLimit ?? 0;
  }
  #handler: ResourceManager<T>;
  /** 由于连接自身原因（如断开连接），需要从连接池移除这个连接。移除的连接不会调用 handler.dispose() */
  remove(conn: T): void {
    const info = this.#pool.get(conn);
    if (!info) return;
    this.#pool.delete(conn);
    if (info.isFree) {
      const index = this.#free.findIndex((item) => item.conn == conn);
      this.#free.splice(index, 1);
    }
  }
  #queue: { resolve(conn: T): void; reject(e: any): void }[] = [];
  get(): Promise<T> {
    if (this.#closedError) return Promise.reject(this.#closedError);
    if (this.#free.length) {
      const conn = this.#free.pop()!.conn;
      // this.#handler.markUsed?.(conn);
      const state = this.#pool.get(conn)!;
      state.isFree = false;
      state.useTotal++;
      return Promise.resolve(conn);
    }
    if (this.totalCount >= this.maxCount) {
      return new Promise((resolve, reject) => {
        this.#queue.push({ resolve, reject });
      });
    }

    const promise = this.#handler.create();
    const info: PoolConnState = { isFree: false, useTotal: 1 };
    this.#pool.set(promise, info);
    return promise
      .then((conn) => {
        if (this.#closedError) {
          this.#handler.dispose(conn);
          this.#closeResolver?.();
          throw this.#closedError;
        }
        this.#pool.set(conn, info);
        return conn;
      })
      .finally(() => {
        this.#pool.delete(promise);
      });
  }
  release(conn: T) {
    const state = this.#pool.get(conn);
    if (!state) throw new Error("这个连接不属于这个池");

    // 池已经关闭
    if (this.#closedError) {
      this.#handler.dispose(conn);
      this.#pool.delete(conn);
      if (this.#pool.size === 0) this.#closeResolver?.();
      return;
    }

    if (state.isFree) return;
    if (this.usageLimit > 0 && state.useTotal >= this.usageLimit) {
      this.#pool.delete(conn);
      this.#handler.dispose(conn);
      return;
    }

    if (this.#queue.length) {
      const request = this.#queue.shift()!;
      request.resolve(conn);
    } else {
      state.isFree = true;
      this.#free.push({ conn, date: Date.now() });
      if (this.#timer === undefined && this.freeTimeout) {
        this.#timer = setTimeout(this.#onTimeoutCheck, this.freeTimeout + 50);
      }
    }
  }
  #onTimeoutCheck = () => {
    if (this.freeTimeout <= 0) return;
    this.checkTimeout(this.freeTimeout);
    if (this.#free.length) {
      setTimeout(this.#onTimeoutCheck, this.freeTimeout);
    }
  };

  /** 连接池最大数量 */
  maxCount: number;
  /** 使用次数上限。超过这个值后将关闭连接。如果为0则无上限 */
  usageLimit: number;
  /** 空闲时间超过这个数后将自动释放连接，如果为0则关闭空闲超时。 */
  freeTimeout: number;
  #timer?: number;

  #closeResolver?: () => void;
  #closedError?: Error;
  close(force: boolean = false, err: Error = new Error("Pool is closed")): Promise<void> {
    if (this.#closedError) return Promise.resolve();
    this.#closedError = err;
    for (const item of this.#queue) {
      item.reject(err);
    }
    this.#queue.length = 0;
    for (const item of this.#free) {
      this.#handler.dispose(item.conn);
      this.#pool.delete(item.conn);
    }
    this.#free.length = 0;

    if (force) {
      for (const conn of this.#pool.keys()) {
        if (!(conn instanceof Promise)) {
          this.#handler.dispose(conn);
        }
      }
      this.#pool.clear();
      return Promise.resolve();
    } else if (this.#pool.size !== 0) {
      return new Promise<void>((resolve, reject) => {
        this.#closeResolver = resolve;
      });
    }
    return Promise.resolve();
  }
  /** 池是否已关闭 */
  get closed(): boolean {
    return !!this.#closedError;
  }
  /** 保留的总数 */
  get totalCount(): number {
    return this.#pool.size;
  }
  /** 空闲数量 */
  get idleCount(): number {
    return this.#free.length;
  }
  /** 等待获取的数量 */
  get waitingCount(): number {
    return this.#queue.length;
  }

  /** 检测已经过期的空闲连接，并释放它们 */
  checkTimeout(idleTimeout: number, minCount: number = 0) {
    const now = Date.now();
    const reserve = minCount - (this.totalCount - this.idleCount);

    const limit = reserve > 0 ? this.#free.length - reserve : this.#free.length;

    let i = 0;

    for (; i < limit; i++) {
      const info = this.#free[i];
      if (now - info.date > idleTimeout) {
        this.#handler.dispose(info.conn);
        this.#pool.delete(info.conn);
      } else break;
    }
    if (i) this.#free = this.#free.slice(i);
  }
}
/** @public */
export type PoolOption = {
  /** 连接池保持的最大连接数量。 默认 3 */
  maxCount?: number;
  /** 空闲时间超过这个数后将自动释放连接。默认为 0  */
  idleTimeout?: number;
  /** 使用次数上限。超过这个值后将关闭连接。默认为 0 */
  usageLimit?: number;
};
