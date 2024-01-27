import { type Readable } from "node:stream";
import type { UnderlyingSource, ReadableStreamController, ReadableByteStreamController } from "node:stream/web";

export type BufferViewInfo = {
  view: ArrayBufferView;
  buf: Uint8Array;
  /** 偏移 */
  offset: number;
  /** 剩余长度 */
  size: number;
};
export type NextChunkResult<T> = { value: T; done?: boolean } | { value?: Error | null; done: true };

export class ReadableQueue<T = Uint8Array> {
  private queue: T[] = [];

  ended = false;
  get(cb: (chunk: NextChunkResult<T>) => void) {
    if (this.callback) throw new Error("重复调用");
    if (this.queue.length) cb({ value: this.queue.shift() as T });
    else if (this.readable.closed) cb({ done: true, value: this.readable.errored });
    else if (this.ended) this.callback = cb;
    else {
      this.callback = cb;
      this.readable.resume();
    }
  }
  cancel() {
    this.readable.off("close", this.onClear);
    this.readable.off("end", this.onClear);
    this.readable.off("data", this.onDataAfterEnd);
    this.readable.off("data", this.onDataBeforeEnd);
    const cb = this.callback;
    this.callback = undefined;
    this.readable.pause();
    return cb;
  }
  private callback?: (chunk: NextChunkResult<T>) => void;
  constructor(
    readonly readable: Readable,
    onError: (err?: any) => void = () => {},
    public onClose?: (error?: Error | null) => void
  ) {
    readable.pause();
    if (readable.listenerCount("readable")) readable.removeAllListeners("readable"); //readable事件影响data事件
    readable.on("data", this.onDataBeforeEnd);
    readable.on("close", this.onClear);
    readable.on("error", onError);
    readable.on("end", this.onClear);
    this.rawPush = readable.push;
    readable.push = this.onPush;
  }
  private onPush = (chunk: T) => {
    if (chunk === null && !this.ended) {
      this.ended = true;
      this.readable.on("data", this.onDataAfterEnd);
      this.readable.off("data", this.onDataBeforeEnd);
      this.readable.resume();
    }
    return this.rawPush.call(this.readable, chunk);
  };
  private rawPush: (chunk: T) => boolean;
  private onDataAfterEnd = (chunk: T) => {
    const cb = this.callback;
    this.callback = undefined;
    if (cb) cb({ value: chunk });
    else this.queue.push(chunk);
  };
  private onDataBeforeEnd = (chunk: T) => {
    const cb = this.callback;
    this.callback = undefined;
    cb?.({ value: chunk });
    this.readable.pause();
  };

  private onClear = () => {
    const cb = this.cancel();
    if (cb) {
      this.callback = undefined;
      cb({ done: true, value: this.readable.errored });
    } else if (this.queue.length == 0) {
      this.onClose?.(this.readable.errored); //主动触发
    }
  };
}
export class ReadableSource<T> implements UnderlyingSource {
  private syncChunkGetter: ReadableQueue<T>;
  constructor(private readable: Readable, type?: "bytes") {
    this.syncChunkGetter = new ReadableQueue(readable);
    this.type = type;
    if (type === "bytes") {
      // this.queue = bytesQueueHandler as any;
    }
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
    this.syncChunkGetter.onClose = (err) => {
      err ? ctrl.error(err) : ctrl.close();
    };
  }
  pull(ctrl: ReadableStreamController<T>) {
    this.syncChunkGetter.get((chunk) => {
      if (chunk.done) {
        if (chunk.value) ctrl.error(chunk.value);
        else ctrl.close();
      } else ctrl.enqueue(chunk.value);
    });
  }
  /** cancel将销毁可读流 */
  cancel(reason = new Error("ReadableStream canceled")): void | PromiseLike<void> {
    this.syncChunkGetter.onClose = undefined; //反正cancel 后重复调用 controller.close() 和  controller.error()
    this.readable.destroy(reason);
  }
  type: any;
}
interface ReadableStreamBYOBRequest {
  readonly view: ArrayBufferView | null;
  respond(bytesWritten: number): void;
  respondWithNewView(view: ArrayBufferView): void;
}

const fastArrayBuffer = Buffer.allocUnsafe(1).buffer;
/** 可读字节流chunk处理，避免将 node 的 Buffer 的底层 转移*/
function bytesQueueHandler(
  this: ReadableSource<ArrayBufferLike>,
  ctrl: ReadableByteStreamController,
  chunk: Uint8Array
) {
  if (chunk.buffer === fastArrayBuffer) {
    const buffer = new Uint8Array(chunk.byteLength);
    buffer.set(chunk);
    chunk = buffer;
  }
  const byobRequest = ctrl.byobRequest as unknown as ReadableStreamBYOBRequest | null;
  if (byobRequest) {
    byobRequest.respondWithNewView(chunk as any);
    byobRequest.respond(chunk.byteLength);
  } else {
    ctrl.enqueue(chunk);
  }
}
