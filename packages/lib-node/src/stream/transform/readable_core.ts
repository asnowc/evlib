import { type Readable } from "node:stream";
import type {
  UnderlyingSource,
  ReadableStreamController,
  ReadableByteStreamController,
} from "node:stream/web";
import { createAbortedError } from "../errors.error.js";

export class ReadableQueue<T = Uint8Array> {
  /**
   * @param resolve 获取到下一个 chunk 时的回调
   * @param reject 当不存在下一个chunk 时的回调。这可能是 调用 cancel()、readable 发生异常, 则参数是一个 Error 实例。如果是 readable 已经读取结束，则为 undefined 或 null
   */
  next(
    resolve: (chunk: T) => void,
    reject?: (value: Error | null | undefined) => void
  ) {
    if (this.callback) throw new Error("重复调用");
    if (this.queue.length) {
      resolve(this.queue.shift()!);
      if (this.queue.length === 0) this.onClose?.();
    } else if (this.isNoMoreData) reject?.(this.readable.errored);
    else {
      this.callback = { resolve, reject };
      this.readable.resume();
    }
  }

  private clear() {
    this.isNoMoreData = true;
    // 这可能是 onEnd 触发的， 也可能是onError触发的，也可能是手动触发
    this.readable.pause();
    this.readable.off("end", this.onReadableEnd);
    this.readable.off("close", this.onReadableEnd);
    this.readable.off("error", this.onReadableError);
    this.readable.off("data", this.onDataAfterPushNull);
    this.readable.off("data", this.onDataBeforePushNull);
  }
  private callback?: {
    resolve: (chunk: T) => void;
    reject?: (reason?: Error | null) => void;
  };
  /**
   * @param onClose - 在没有更多数据时触发。
   * @param onAbort - 在被中断时触发。这可以是 Readable 的 error 事件，也可以是手动调用 cancel
   */
  constructor(
    readonly readable: Readable,
    public onClose?: (error?: Error) => void
  ) {
    readable.pause();
    if (readable.listenerCount("readable"))
      readable.removeAllListeners("readable"); //readable事件影响data事件
    readable.on("data", this.onDataBeforePushNull);
    readable.on("end", this.onReadableEnd);
    readable.on("close", this.onReadableEnd); // readable.destroy(undefined) 时会触发 close 事件。此时的 readable.errored===null. 且不会触发 error 事件
    readable.on("error", this.onReadableError);
    this.rawPush = readable.push;
    readable.push = this.onPush;
  }
  private readonly onPush = (chunk: T) => {
    if (chunk === null && !this.isPushedNull) {
      this.isPushedNull = true;
      this.readable.on("data", this.onDataAfterPushNull);
      this.readable.off("data", this.onDataBeforePushNull);
      this.readable.resume();
    }
    return this.rawPush.call(this.readable, chunk);
  };
  private rawPush: (chunk: T) => boolean;
  /** Readable 的 end 或 error 事件发出后变为 true */
  isNoMoreData = false;
  /** readable 是否已经 push(null) */
  isPushedNull = false;
  /** 缓存队列。 在 Readable push(null) 后, 收集 Readable 中的缓冲区的数据 (优先解决存在的callback)，这样可以不阻止 Readable 的 close 事件 */
  private queue: T[] = [];
  private readonly onDataAfterPushNull = (chunk: T) => {
    const cb = this.callback;
    this.callback = undefined;
    if (cb) cb.resolve(chunk);
    else this.queue.push(chunk);
  };
  private readonly onDataBeforePushNull = (chunk: T) => {
    const cb = this.callback;
    this.callback = undefined;
    cb?.resolve(chunk);
    this.readable.pause();
  };
  private rejectCallback(error?: Error) {
    const cb = this.callback;
    if (cb) {
      this.callback = undefined;
      cb.reject?.(error);
    }
  }
  /**
   * @remarks 撤销对 readable 的 控制.
   */
  private cancel(reason: any = createAbortedError()) {
    if (!(reason instanceof Error))
      reason = new Error("Readable has been aborted");
    this.clear();
    if (this.queue.length == 0) {
      this.onClose?.(reason);
      this.rejectCallback(reason);
    }
  }
  private onReadableEnd = () => {
    if (!this.readable.readableEnded) {
      // readable.destroy(undefined) 时会触发 close 事件。此时的 readable.errored===null. 且不会触发 error 事件
      this.cancel();
      return;
    }
    this.clear();
    if (this.queue.length == 0) {
      this.onClose?.(); //主动触发
      this.rejectCallback();
    }
  };

  private onReadableError = this.cancel.bind(this);

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    const readable = this.readable;
    try {
      while (!readable.readableEnded) {
        const value = await new Promise<T>((resolve, reject) => {
          this.callback = { resolve, reject };
          this.readable.resume();
        });
        yield value;
      }
    } catch (error) {
      if (!this.readable.readableEnded) throw error;
    }
    if (this.queue.length) yield* this.queue;
    this.queue = [];
    this.onClose?.();
  }
}
export class ReadableSource<T> implements UnderlyingSource {
  private syncChunkGetter!: ReadableQueue<T>;
  iter!: AsyncGenerator<T, void, void>;
  constructor(private readable: Readable, type?: "bytes") {
    if (type !== "bytes")
      this.bytesQueueHandler = (ctrl: ReadableStreamController<T>, chunk) =>
        ctrl.enqueue(chunk as T);
  }
  start(ctrl: ReadableStreamController<T>) {
    const readable = this.readable;
    if (readable.readableEnded) {
      ctrl.close();
      return;
    }
    if (!readable.readable) {
      ctrl.error(readable.errored ?? new Error("raw stream is unreadable"));
      return;
    }
    this.syncChunkGetter = new ReadableQueue(readable);
    this.syncChunkGetter.onClose = (err) => {
      err ? ctrl.error(err) : ctrl.close();
    };
  }
  pull(ctrl: ReadableStreamController<T>) {
    this.syncChunkGetter.next((chunk) => {
      this.bytesQueueHandler(ctrl, chunk);
    });
  }
  /** cancel将销毁可读流 */
  cancel(
    reason = new Error("ReadableStream canceled")
  ): void | PromiseLike<void> {
    this.syncChunkGetter.onClose = undefined; //反正cancel 后重复调用 controller.close() 和  controller.error()
    this.readable.destroy(reason);
  }
  /** 可读字节流chunk处理，避免将 node 的 Buffer 的底层 转移*/
  bytesQueueHandler(
    ctrl: ReadableByteStreamController | ReadableStreamController<T>,
    chunk: T
  ) {
    const byobRequest = (ctrl as any).byobRequest as
      | ReadableStreamBYOBRequest
      | undefined;
    if (byobRequest) {
      let buf = chunk as Uint8Array;
      if (buf.buffer === fastArrayBuffer) {
        const buffer = new Uint8Array(buf.byteLength);
        buffer.set(buf);
        buf = buffer;
      }
      byobRequest.respondWithNewView(buf);
      byobRequest.respond(buf.byteLength);
    } else {
      ctrl.enqueue(chunk as any);
    }
  }
}
interface ReadableStreamBYOBRequest {
  readonly view: ArrayBufferView | null;
  respond(bytesWritten: number): void;
  respondWithNewView(view: ArrayBufferView): void;
}

const fastArrayBuffer = Buffer.allocUnsafe(1).buffer;
