import { Readable } from "node:stream";
import type { ByteReader } from "../byte_reader.js";
import { ReadableQueue, NextChunkResult } from "../transform/readable_core.js";
import { ReadableStream, ReadableStreamDefaultReadResult } from "node:stream/web";
import { resolveChunk, WaitingQueue } from "../byte_stream/abstract_byte_stream.js";

/**
 * @alpha
 * @remarks 创建对 Readable 的 StreamScanner
 */
export function createByteReaderFromWebStream<T extends Uint8Array>(
  stream: ReadableStream<T>
): { read: ByteReader<T>; cancel(reason?: Error): T | null } {
  const readable = stream.getReader();

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
      if (queue.length === 1) readNext();
    });
  }

  async function readNext() {
    while (queue[0]) {
      let res: ReadableStreamDefaultReadResult<T>;
      if (residueChunk) {
        residueChunk = resolveChunk(queue, residueChunk);
      } else {
        res = await readable.read().catch((e) => ({ done: true, value: e }));
        if (res.done) {
          ended = true;
          return cancel(res.value ?? new Error("no more data"));
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
    readable.releaseLock();
    return residueChunk ?? null;
  }

  return { cancel, read };
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
  cancel(reason?: Error): Buffer | null;
} {
  const getter = new ReadableQueue<Buffer>(readable);
  const queue: WaitingQueue[] = [];
  let residueChunk: Buffer | undefined;
  let noMoreErr: Error | undefined;

  function read(): Promise<Buffer | null>;
  function read(size: number): Promise<Buffer>;
  function read(size: number, safe?: boolean): Promise<Buffer | null>;
  function read<R extends ArrayBufferView>(view: R): Promise<R>;
  function read<R extends ArrayBufferView>(view: R, safe?: boolean): Promise<R | null>;
  function read(view?: number | ArrayBufferView, safe?: boolean): Promise<Buffer | null> {
    return new Promise<unknown>(function (resolve, reject) {
      const item: WaitingQueue = { resolve, reject };
      if (noMoreErr) return safe ? resolve(null) : reject(noMoreErr);

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

      queue.push(item);
      if (queue.length === 1) readNext();
    }) as Promise<Buffer | null>;
  }

  async function readNext() {
    while (queue[0]) {
      let res: NextChunkResult<Buffer>;
      if (residueChunk) {
        residueChunk = resolveChunk(queue, residueChunk);
      } else if (!readable.readable) {
        return onNoMore(readable.errored!);
      } else {
        res = await next();
        if (res.done) {
          return onNoMore(res.value as Error | undefined);
        }
        residueChunk = resolveChunk(queue, res.value);
      }
    }
  }
  const next = () => {
    return new Promise<NextChunkResult<Buffer>>((resolve, reject) => {
      getter.get(resolve);
    });
  };
  function onNoMore(error?: Error) {
    noMoreErr = error ? error : createNoMoreDataErr();
    getter.cancel();
    rejectQueue(queue, noMoreErr);
  }

  if (!readable.readable) noMoreErr = readable.errored ?? createNoMoreDataErr();

  return {
    cancel(reason = new Error("Reader has be cancel")): null | Buffer {
      onNoMore(reason);
      if (residueChunk && readable.readable) {
        readable.unshift(residueChunk);
        return null;
      }
      let returnChunk = residueChunk;
      residueChunk = undefined;

      return returnChunk === undefined ? null : returnChunk;
    },
    read,
  };
}
function createNoMoreDataErr() {
  return new Error("no more data");
}

function rejectQueue(queue: WaitingQueue[], reason: Error) {
  for (let i = 0; i < queue.length; i++) {
    let item = queue[i];
    if (item.safe) item.resolve(null);
    else item.reject(reason);
  }
}
