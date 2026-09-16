import { clearTimeout, setTimeout } from "../core/internal.ts";

/** @public */
export interface ResourceManager<T> {
  create(): Promise<T>;
  dispose(conn: T, force?: boolean): void;
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
type CloseInfo = {
  error: Error;
  closing?: {
    resolve: () => void;
    reject: (reason?: any) => void;
    promise: Promise<void>;
  };
};

type PoolConnState = {
  /** 连接被使用的总次数 */
  useTotal: number;
  /** isFree 状态更新的最后更新时间 */
  date: number;
};
/**
 * 资源池，可以用于实现连接池
 * @public
 */
export class ResourcePool<T> {
  static defaultMaxCount = 3;
  #pool = new Map<T, PoolConnState>();
  #free = new Set<T>();
  #connecting = new Set<{}>();
  constructor(handler: ResourceManager<T>, option: PoolOption = {}) {
    this.#handler = handler;
    this.#maxCount = option.maxCount ?? ResourcePool.defaultMaxCount;
    this.#freeTimeout = option.idleTimeout ?? 0;
    this.#usageLimit = option.usageLimit ?? 0;
  }

  #handler: ResourceManager<T>;
  /** 由于连接自身原因（如断开连接），需要从连接池移除这个连接。移除的连接不会调用 handler.dispose() */
  remove(conn: T): void {
    const info = this.#pool.get(conn);
    if (!info) return;
    this.#pool.delete(conn);
    this.#free.delete(conn);

    if (this.#closed) this.#checkCloseResolve(this.#closed);
    else this.#checkNewConnect();
  }
  /**
   * 当由可用的连接释放回连接池时调用。会尝试将连接分配给排队中的请求，如果没有排队请求，则将连接标记为空闲。
   */
  #onConnectFree(conn: T, state: PoolConnState) {
    const item = this.#queue.shift();
    state.date = Date.now();
    if (item) {
      state.useTotal++;
      item.resolve(conn);
      return;
    }
    if (this.#closed) {
      this.#pool.delete(conn);
      this.#handler.dispose(conn);
      this.#checkCloseResolve(this.#closed);
      return;
    }

    this.#free.add(conn);
    if (this.#timer === undefined && this.#freeTimeout) {
      this.#timer = setTimeout(this.#onTimeoutCheck, this.#freeTimeout + 50);
    }
  }
  async #createConnect() {
    const abc = {};

    this.#connecting.add(abc);
    let conn: T;
    try {
      conn = await this.#handler.create();
    } catch (error) {
      if (!this.#connecting.has(abc)) return;
      this.#connecting.delete(abc);
      this.clearQueue(error);
      if (this.#closed) this.#checkCloseResolve(this.#closed);
      return;
    }
    if (!this.#connecting.has(abc)) {
      this.#handler.dispose(conn);
      return;
    }

    this.#connecting.delete(abc);

    const state: PoolConnState = { useTotal: 0, date: Date.now() };
    this.#pool.set(conn, state);
    this.#onConnectFree(conn, state);
  }
  #checkNewConnect() {
    if (!this.#queue.length) return;
    if ((this.#pool.size + this.connectingCount < this.#maxCount)) {
      this.#createConnect();
    }
  }

  #queue = Array<{ resolve(conn: T): void; reject(e: any): void }>();
  /** 获取一个已经存在的空闲连接，如果没有则返回 null。连接池关闭不会影响此方法 */
  getExists(): T | null {
    for (const item of this.#free) {
      this.#free.delete(item);
      return item;
    }
    return null;
  }
  /** 获取一个连接，如果没有可用连接则排队等待。如果连接池已关闭则抛出异常。 */
  get(): Promise<T> {
    if (this.#closed) return Promise.reject(this.#closed.error);
    if (this.#free.size) {
      const conn = this.getExists()!;
      const state = this.#pool.get(conn)!;
      state.date = Date.now();
      state.useTotal++;
      return Promise.resolve(conn);
    }
    return new Promise<T>((resolve, reject) => {
      this.#queue.push({ resolve, reject });
      this.#checkNewConnect();
    });
  }
  release(conn: T) {
    const state = this.#pool.get(conn);
    if (!state) return;

    if (this.#usageLimit > 0 && state.useTotal >= this.#usageLimit) {
      this.#pool.delete(conn);
      this.#handler.dispose(conn);
      if (this.#closed) this.#checkCloseResolve(this.#closed);
      else this.#checkNewConnect();
      return;
    }

    this.#onConnectFree(conn, state);
  }

  /** 连接池最大数量 */
  get maxCount(): number {
    return this.#maxCount;
  }
  #maxCount: number;

  /** 使用次数上限。超过这个值后将关闭连接。如果为0则无上限 */
  get usageLimit(): number {
    return this.#usageLimit;
  }
  #usageLimit: number;

  /** 空闲时间超过这个数后将自动释放连接，如果为0则关闭空闲超时。 */
  get freeTimeout(): number {
    return this.#freeTimeout;
  }
  #freeTimeout: number;

  /** 创建连接中的数量 */
  get connectingCount(): number {
    return this.#connecting.size;
  }

  /** 当前保持连接的数量 */
  get totalCount(): number {
    return this.#pool.size;
  }
  /** 空闲连接数量 */
  get idleCount(): number {
    return this.#free.size;
  }
  /** 排队中的数量 */
  get waitingCount(): number {
    return this.#queue.length;
  }

  #timer?: any;
  #onTimeoutCheck = () => {
    if (this.#freeTimeout <= 0) {
      this.#timer = undefined;
      return;
    }
    this.removeFreeTimeout(this.#freeTimeout);
    if (this.#free.size && this.#freeTimeout) {
      this.#timer = setTimeout(this.#onTimeoutCheck, this.#freeTimeout);
    } else {
      this.#timer = undefined;
    }
  };

  /**
   * 删除空虚时间超过 idleTimeout 的空闲连接
   * @param idleTimeout 空闲超时时间，单位毫秒
   */
  removeFreeTimeout(idleTimeout: number) {
    const now = Date.now();

    for (const item of this.#free) {
      const state = this.#pool.get(item);
      if (state && (now - state.date > idleTimeout)) {
        this.#free.delete(item);
        this.#pool.delete(item);
        this.#handler.dispose(item);
      } else {
        break;
      }
    }

    this.#checkNewConnect();
  }

  #closed?: CloseInfo;

  /**
   * 关闭连接池。关闭后不能再获取新的连接。空闲连接将会被立即关闭.
   * 返回的 Promise 在排队中的请求被解决，然后等待所有已被借用的连接释放后再 resolve
   */
  close(): Promise<void> {
    if (this.#closed) return this.#closed.closing?.promise ?? Promise.resolve();
    const closed: CloseInfo = { error: new Error("Pool is closed") };
    this.#closed = closed;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }

    this.clearFree();
    if (this.#pool.size + this.connectingCount + this.#queue.length <= 0) {
      return Promise.resolve();
    }

    let resolve: () => void;
    let reject: (reason?: any) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    closed.closing = { promise, resolve: resolve!, reject: reject! };
    return promise;
  }
  destroy(err?: Error): void {
    if (this.#closed) return;
    err ??= new Error("Pool is destroyed");
    this.#closed = { error: err };
    this.clearQueue(err);

    const free = this.#free;
    for (const conn of this.#pool.keys()) {
      this.#handler.dispose(conn, !free.has(conn));
    }
    this.#pool.clear();
    free.clear();
  }
  #checkCloseResolve(info: CloseInfo) {
    const resolver = info.closing;
    if (!resolver) return;
    if (this.#pool.size + this.connectingCount + this.#queue.length <= 0) {
      info.closing = undefined;
      resolver.resolve();
    }
  }
  /** 池是否已关闭 */
  get closed(): boolean {
    return !!this.#closed;
  }

  /** 清空等待队列中的所有请求 */
  clearQueue(error: unknown): void {
    for (const item of this.#queue) {
      item.reject(error);
    }
    this.#queue.length = 0;

    this.#connecting.clear();
  }
  /** 关闭所有空闲连接 */
  clearFree(): void {
    for (const item of this.#free) {
      this.#pool.delete(item);
      this.#handler.dispose(item);
    }
    this.#free.clear();
  }
}
