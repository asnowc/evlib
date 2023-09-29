import { Duplex, Readable, Transform, Writable } from "node:stream";

type NodeStream = Readable | Writable | Duplex | Transform;
type State = ReadableState<unknown> | WritableState;
export function getStreamError(stream: NodeStream): null | Error;
export function getStreamError(stream: any) {
    const state: State = stream._readableState || stream._writableState;
    return state.errored;
}
export function streamIsAlive(stream: NodeStream): boolean;
export function streamIsAlive(stream: any) {
    const state: State = stream._readableState || stream._writableState;
    return !(state.destroyed || state.closed);
}

interface StreamState {
    /**
     * 流仍在构建中，在构建完成或失败之前不能被破坏。
     * 异步构造是可选的，因此我们从构造开始。
     */
    constructed: boolean;
    objectMode: boolean;
    highWaterMark: number;
    // Should .destroy() be called after 'finish' (and potentially 'end').
    autoDestroy: boolean;
    // Has it been destroyed
    destroyed: boolean;
    // Indicates whether the stream has errored. When true all write() calls
    // should return false. This is needed since when autoDestroy
    // is disabled we need a way to tell whether the stream has failed.
    errored: null | Error;
    // True if the error was already emitted and should not be thrown again.
    errorEmitted: boolean;
    // Should close be emitted on destroy. Defaults to true.
    emitClose: boolean;
    // Indicates whether the stream has finished destroying.
    closed: boolean;
    // True if close has been emitted or would have been emitted
    // depending on emitClose.
    closeEmitted: boolean;
}

export interface WritableState extends StreamState {
    // if _final has been called.
    finalCalled: boolean;
    // drain event flag.
    needDrain: boolean;
    // At the start of calling end()
    ending: boolean;
    // When end() has been called, and returned.
    ended: boolean;
    // When 'finish' is emitted.
    finished: boolean;
    decodeStrings: string;
    // Not an actual buffer we keep track of, but a measurement
    // of how much we're waiting to get pushed to some underlying
    // socket or file.
    length: number;
    // A flag to see when we're in the middle of a write.
    writing: boolean;
    // When true all writes will be buffered until .uncork() call.
    corked: number;
    // A flag to be able to tell if the onwrite cb is called immediately,
    // or on a later tick.  We set this to true at first, because any
    // actions that shouldn't happen until "later" should generally also
    // not happen before the first write call.
    sync: boolean;
    // A flag to know if we're processing previously buffered items, which
    // may call the _write() callback in the same tick, so that we don't
    // end up in an overlapped onwrite situation.
    bufferProcessing: boolean;
    // The callback that's passed to _write(chunk, cb).
    onwrite: (stream: any, er: any) => void;
    // The callback that the user supplies to write(chunk, encoding, cb).
    writecb: null;
    // The amount that is being written when _write is called.
    writelen: number;
    // Storage for data passed to the afterWrite() callback in case of
    // synchronous _write() completion.
    afterWriteTickInfo: null;
    // Number of pending user-supplied write callbacks
    // this must be 0 before 'finish' can be emitted.
    pendingcb: 0;

    // Emit prefinish if the only thing we're waiting for is _write cbs
    // This is relevant for synchronous Transform streams.
    prefinished: boolean;
}
interface QueueNode<T> {
    data: T;
    next: QueueNode<T> | null;
}
interface BufferList<T> {
    head: QueueNode<T> | null;
    tail: QueueNode<T> | null;
    length: number;

    push(v: T): void;
    unshift(v: T): void;

    shift(): undefined | T;

    clear(): void;
    /** 将队列中所有chunk拼接, 队列保持不变, 返回拼接的内容 */
    join(s: string): string;

    /** 将队列中所有chunk连接, 队列保持不变, 返回连接后的值 */
    concat(n: number): Buffer;

    /** 读取指定长度, 读取的部分被移除 */
    consume(n: number): Buffer;
    consume(n: number, hasStrings: false | undefined): Buffer;
    consume(n: number, hasStrings: true): string;
    consume(n: number, hasStrings?: boolean): T;

    /** 返回队头的值, 使用去要确保head存在 */
    first(): T;

    [Symbol.iterator](): Generator<T, void, void>;
}
export interface ReadableState<T> extends StreamState {
    buffer: BufferList<T>;
    pipes: ReadableState<T>[];
    length: number;
    flowing: null;
    ended: boolean;
    endEmitted: boolean;
    reading: boolean;

    sync: boolean;
    needReadable: boolean;
    emittedReadable: boolean;
    readableListening: boolean;
    resumeScheduled: boolean;
    defaultEncoding: BufferEncoding;
    // Ref the piped dest which we need a drain event on it
    awaitDrainWriters: null | Writable | Set<Writable>;
    multiAwaitDrain: boolean;
    // If true, a maybeReadMore has been scheduled.
    readingMore: boolean;
    dataEmitted: boolean;
    decoder: null | unknown;
    encoding: null | BufferEncoding;
}
export interface InternalReadable<T> extends Readable {
    _readableState: ReadableState<T>;
}
export interface InternalWritable extends Writable {
    _writableState: WritableState;
}
export interface InternalDuplex<T> extends Duplex {
    _readableState: ReadableState<T>;
    _writableState: WritableState;
}
export interface InternalTransform<T> extends Transform {
    _readableState: ReadableState<T>;
    _writableState: WritableState;
}
