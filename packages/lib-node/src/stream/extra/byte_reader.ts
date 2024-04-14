import { Readable } from "node:stream";
import type { ByteReader } from "../byte_reader.js";
import {
  ReadableStream,
  ReadableStreamDefaultReadResult,
} from "node:stream/web";
import { WithPromise, withPromise } from "evlib";
import { NumericalRangeError } from "evlib/errors";
import {
  createNoMoreDataErr,
  createAbortedError,
  createCallAheadError,
} from "../errors.error.js";
type WaitingPromise = WithPromise<Uint8Array> & {
  buf?: Uint8Array;
  offset: number;
};

/**
 * @public
 * @remarks 创建对 Readable 的 StreamScanner
 */
export function readableStreamToByteReader<T extends Uint8Array>(
  stream: ReadableStream<T>
): { read: ByteReader; cancel(reason?: Error): Uint8Array | null } {
  const readable = stream.getReader();
  let noMoreErr: Error | undefined;
  let waitCtrl = new WaitingCtrl<Uint8Array>();

  function read(len_view: number): Promise<Uint8Array>;
  function read(len_view: Uint8Array): Promise<Uint8Array>;
  function read(len_view: number | Uint8Array): Promise<Uint8Array | null> {
    if (waitCtrl.wait) return Promise.reject(createCallAheadError());
    else if (noMoreErr) return Promise.reject(noMoreErr);
    if (typeof len_view === "number") {
      if (len_view <= 0) return Promise.reject(new NumericalRangeError(0));
      const data = waitCtrl.checkResidue(len_view);
      if (data) return Promise.resolve(data);
      len_view = new Uint8Array(len_view);
    } else if (len_view instanceof Uint8Array) {
      const data = waitCtrl.checkResidue(len_view.byteLength);
      if (data) {
        len_view.set(data);
        return Promise.resolve(len_view);
      }
    }
    const promise = waitCtrl.createWait(len_view);
    readNext();
    return promise;
  }

  async function readNext() {
    if (!waitCtrl.wait) return;
    let res: ReadableStreamDefaultReadResult<T>;
    while (true) {
      res = await readable.read().catch((e) => ({ done: true, value: e }));
      if (res.done) break;
      if (waitCtrl.set(waitCtrl.wait, res.value)) return;
    }
    noMoreErr = res.value ?? createNoMoreDataErr();
    waitCtrl.reject(noMoreErr);
  }

  function cancel(reason = createAbortedError()): null | Uint8Array {
    waitCtrl.reject(reason);
    readable.releaseLock();
    return waitCtrl.takeResidue();
  }

  return { cancel, read };
}

/**
 * @public
 * @remarks 创建对 Readable 的 Scanner. 它不监听 readable 的 error 事件
 */
export function readableToByteReader(stream: Readable): {
  read: ByteReader;
  cancel(reason?: Error): Buffer | null;
} {
  let noMoreErr: Error | undefined;
  let wait: WaitingPromise | undefined;

  function read(len_view: number): Promise<Uint8Array>;
  function read(len_view: Uint8Array): Promise<Uint8Array>;
  function read(len_view: number | Uint8Array): Promise<Uint8Array | null> {
    if (wait) return Promise.reject(createCallAheadError());
    else if (noMoreErr) return Promise.reject(noMoreErr);
    if (typeof len_view === "number") {
      if (len_view <= 0) return Promise.reject(new NumericalRangeError(0));
      const len = len_view;
      if (stream.readableLength >= len)
        return Promise.resolve(stream.read(len));
      len_view = new Uint8Array(len);
    } else if (len_view instanceof Uint8Array) {
      if (stream.readableLength >= len_view.byteLength) {
        const chunk = stream.read(len_view.byteLength);
        len_view.set(chunk);
        return Promise.resolve(len_view);
      }
    }
    const item = withPromise<Uint8Array | null, any, any>({
      buf: len_view,
      offset: 0,
    });
    wait = item;
    return item.promise;
  }
  function onReadable() {
    if (!wait) return;
    if (!wait.buf) {
      const chunk: Buffer = stream.read();
      if (chunk) wait.resolve(chunk);
      return;
    }
    let need = wait.buf.byteLength - wait.offset;
    if (stream.readableLength >= need) {
      wait.buf.set(stream.read(need)!, wait.offset);
      wait.resolve(wait.buf);
      wait = undefined;
    } else {
      const chunk: Buffer = stream.read();
      if (chunk) {
        wait.buf.set(chunk, wait.offset);
        wait.offset += chunk.byteLength;
      }
    }
  }

  stream.pause();
  function rejectWait(reason: Error) {
    if (wait) {
      wait.reject(reason);
      wait = undefined;
    }
  }
  function clear() {
    stream.off("readable", onReadable);
    stream.off("end", onAbort);
    stream.off("close", onAbort);
    stream.off("error", onAbort);
  }
  function onAbort() {
    noMoreErr = stream.errored ?? createNoMoreDataErr();
    clear();
    rejectWait(noMoreErr);
  }
  if (stream.readable) {
    stream.on("readable", onReadable);
    stream.on("end", onAbort);
    stream.on("close", onAbort);
    stream.on("error", onAbort);
  } else noMoreErr = stream.errored ?? createNoMoreDataErr();

  return {
    cancel(reason = createAbortedError()): null {
      clear();
      rejectWait(reason);
      return null;
    },
    read,
  };
}

class WaitingCtrl<T extends Uint8Array> {
  wait?: WaitingPromise;
  private residueChunk: Uint8Array | undefined;

  set(wait: WaitingPromise, chunk: Uint8Array): boolean {
    if (!wait.buf) {
      if (this.residueChunk) {
        wait.resolve(this.residueChunk);
        this.residueChunk = chunk;
      } else {
        wait.resolve(chunk);
      }
      this.wait = undefined;
      return true;
    }
    let need = wait.buf.byteLength - wait.offset;
    if (chunk.byteLength > need) {
      wait.buf.set(chunk.subarray(0, need));
      wait.resolve(wait.buf);
      this.residueChunk = chunk.subarray(need);
      return true;
    } else if (chunk.byteLength === need) {
      wait.buf.set(chunk, wait.offset);
      wait.resolve(wait.buf);
      return true;
    } else {
      wait.buf.set(chunk, wait.offset);
      wait.offset += chunk.byteLength;
      return false;
    }
  }
  createWait(buf?: T) {
    this.wait = withPromise({ buf, offset: 0 });
    return this.wait!.promise;
  }
  checkResidue(len: number) {
    let residueChunk = this.residueChunk;
    if (residueChunk) {
      if (residueChunk.byteLength === len) {
        let data = residueChunk;
        residueChunk = undefined;
        return data;
      } else if (residueChunk.byteLength > len) {
        let data = residueChunk.subarray(0, len);
        this.residueChunk = residueChunk.subarray(len);
        return data;
      }
    }
  }
  reject(reason?: any) {
    this.wait?.reject(reason);
    this.wait = undefined;
  }
  takeResidue() {
    const data = this.residueChunk;
    if (data) {
      this.residueChunk = undefined;
      return data;
    }
    return null;
  }
}
