import { Readable } from "node:stream";
import type { ByteReader } from "../byte_reader.js";
import { takeChunkFromReadableState } from "../transform/readable_core.js";
import { ReadableStream } from "node:stream/web";
import { resolveChunk, WaitingQueue } from "../byte_stream/abstract_byte_stream.js";

/**
 * @alpha
 * @remarks 创建对 Readable 的 StreamScanner
 */
export function createByteReader<T extends Uint8Array>(
  iterable: AsyncIterable<T>
): { read: ByteReader<T>; cancel(reason?: Error): T | null } {
  const iter = iterable[Symbol.asyncIterator]();
  let ended = false;
  let errored: Error | undefined;
  let residueChunk: T | undefined;
  const queue: WaitingQueue[] = [];

  function read(): Promise<null | T>;
  function read(size: number): Promise<Uint8Array>;
  function read(size: number, safe?: boolean): Promise<Uint8Array | null>;
  function read<P extends ArrayBufferView>(size: P): Promise<P | null>;
  function read<P extends ArrayBufferView>(size: P, safe?: boolean): Promise<P | null>;
  function read<P extends ArrayBufferView>(
    view?: number | Uint8Array | P,
    safe?: boolean
  ): Promise<Uint8Array | P | null> {
    if (ended) {
      if (view === undefined || safe) Promise.resolve(null);
      else Promise.reject(errored);
    }
    if (errored) Promise.reject(errored);

    return new Promise<P | Uint8Array | null>(function (resolve, reject) {
      if (view === undefined) {
        queue.push({ resolve, reject, safe: true });
        return;
      }
      let buf: Uint8Array;
      if (typeof view === "number") {
        if (view > 0) {
          buf = new Uint8Array(view);
          view = buf;
        } else throw new Error("size must be greater than 0");
      } else {
        buf = view instanceof Uint8Array ? view : new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
      }
      queue.push({ resolve, reject, safe, viewInfo: { buf, view, offset: 0, size: view.byteLength } });
      readNext();
    });
  }

  async function readNext() {
    while (queue[0]) {
      let res: IteratorResult<T, any>;
      if (residueChunk) {
        residueChunk = resolveChunk(queue, residueChunk);
      } else {
        res = await iter.next();
        if (res.done) {
          ended = true;
          return cancel(new Error("no more data"));
        }
        residueChunk = resolveChunk(queue, res.value);
      }
    }
  }

  function cancel(reason = new Error("Reader has be cancel")): null | T {
    if (errored) {
      for (const item of queue) {
        item.reject(errored);
      }
    } else {
      errored = reason;
      for (const item of queue) {
        if (item.safe) item.resolve(null);
        else item.reject(reason);
      }
    }
    queue.length = 0;
    iter.return!();
    return residueChunk ?? null;
  }

  return { cancel, read };
}
export function createByteReaderFromWebStream(stream: ReadableStream) {
  return createByteReader(stream);
}
interface BufferReader extends ByteReader<Buffer> {
  /** 读取一个 chunk */
  (): Promise<Buffer | null>;
  /** @remarks 读取指定长度，如果Stream不足该长度，则抛出异常 */
  (len: number): Promise<Buffer>;
  /** @remarks 安全读取指定长度，如果Stream不足该长度，则返回 null */
  (len: number, safe?: boolean): Promise<Buffer | null>;
}
/**
 * @public
 * @remarks 创建对 Readable 的 Scanner. 它不监听 readable 的 error 事件
 */
export function createByteReaderFromReadable(readable: Readable): {
  read: BufferReader;
  cancel(reason?: Error): null;
} {
  readable.pause();
  const waitingQueue: WaitingQueue[] = [];
  let closed: Error | undefined;

  function read(): Promise<Buffer | null>;
  function read(size: number): Promise<Buffer>;
  function read(size: number, safe?: boolean): Promise<Buffer | null>;
  function read<R extends ArrayBufferView>(view: R): Promise<R>;
  function read<R extends ArrayBufferView>(view: R, safe?: boolean): Promise<R | null>;
  function read(view?: number | ArrayBufferView, safe?: boolean): Promise<Buffer | null> {
    return new Promise<unknown>(function (resolve, reject) {
      const item: WaitingQueue = { resolve, reject };

      if (view === undefined) {
        item.safe = true;
      } else if (typeof view === "number") {
        if (view <= 0) return reject(new Error("size must be greater than 0"));
        item.safe = Boolean(safe);
        const rawView = Buffer.alloc(view);
        item.viewInfo = {
          view: rawView,
          buf: rawView,
          offset: 0,
          size: view,
        };
      } else if (ArrayBuffer.isView(view)) {
        if (view.byteLength <= 0) return reject(new Error("buffer view length must be greater than 0"));
        item.safe = Boolean(safe);
        const buf = view instanceof Buffer ? view : Buffer.from(view.buffer, view.byteOffset, view.byteLength);

        item.viewInfo = {
          buf,
          view,
          offset: 0,
          size: view.byteLength,
        };
      } else {
        return reject(
          new Error("Parameter 1 should be of type undefined, number, or a ArrayBufferView. Actual:" + typeof view)
        );
      }

      if (closed) return safe ? resolve(null) : reject(closed);
      waitingQueue.push(item);
      onReadable();
    }) as Promise<Buffer | null>;
  }

  function onReadable() {
    if (checkQueue(waitingQueue, readable)) onEnd(new Error("Stream no more data"));
  }
  function onEnd(reason: any) {
    closed = reason;
    readable.off("readable", onReadable);
    readable.off("close", onEnd);
    rejectQueue(waitingQueue, reason);
  }
  if (!readable.readableEnded) {
    readable.on("readable", onReadable); //监听数据变化, 包括push(null)
    readable.on("close", onEnd); // 监听destroy()
  }
  function cancel(reason?: any): null {
    onEnd(reason ?? new Error("Reader has be cancel"));
    return null;
  }

  return { cancel, read };
}

/**
 * @remarks 检查 Readable的内部队列, 并解决等待队列
 * @returns 如果流不会再有更多数据, 则返回 true
 */
function checkQueue(queue: WaitingQueue[], readable: Readable) {
  const state = (readable as any)._readableState;

  while (queue.length) {
    let handle = queue[0];
    const viewInfo = handle.viewInfo;
    if (!viewInfo) {
      const chunk = takeChunkFromReadableState(state);
      if (chunk) {
        handle.resolve(chunk);
        queue.shift();
      } else return chunk === null;
    } else {
      const buf = readable.read(viewInfo.size) as Uint8Array | null;
      if (!buf) return state.ended || state.closed;
      viewInfo.buf.set(buf, viewInfo.offset);
      viewInfo.offset += buf.byteLength;
      viewInfo.size -= buf.byteLength;

      if (viewInfo.size > 0) return state.ended || state.closed;
      handle.resolve(viewInfo.view);
      queue.shift();
    }
  }
  readable.read(0); //调用以检测 readable 的各种事件
}
function rejectQueue(queue: WaitingQueue[], reason: Error) {
  for (let i = 0; i < queue.length; i++) {
    let item = queue[i];
    if (item.safe) item.resolve(null);
    else item.reject(reason);
  }
}
