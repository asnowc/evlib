import { Duplex, Readable, Writable } from "node:stream";
import { vi, Mock } from "vitest";

/** 创建一个已经构造完毕的可读流 */
export function createReadable(opts: ReadableOpts = {}) {
  const mockOpts = initOpt(opts);
  const stream = new Readable(mockOpts);
  return { stream, mockOpts };
}
/** 创建一个已经构造完毕的可写流 */
export function createWritable(opts: WritableOpts = {}) {
  const mockOpts = initOpt(opts);
  const stream = new Writable(mockOpts);
  return { stream, mockOpts };
}
/** 创建一个已经构造完毕的双工流 */
export function createDuplex(opts: DuplexOpts = {}) {
  const mockOpts = initOpt(opts);
  const stream = new Duplex(mockOpts);
  return { stream, mockOpts };
}

//不处理 构造
export function initOpt(opts: DuplexOpts, construct?: boolean): DuplexMockHd {
  const mockOpts = { ...opts } as DuplexMockHd;
  mockOpts.destroy = vi.fn(
    opts.destroy ?? ((err, cb) => cb(null)),
  ) as StreamMockHd["destroy"];
  mockOpts.read = vi.fn(opts.read ?? ((size) => size));
  mockOpts.write = vi.fn(
    opts.write ?? ((chunk, ec, cb) => cb(null)),
  ) as WritableMockHd["write"];
  mockOpts.final = vi.fn(
    opts.final ?? ((cb) => cb(null)),
  ) as WritableMockHd["final"];
  return mockOpts;
}

export type WritableOpts = NonNullable<
  ConstructorParameters<typeof Writable>[0]
>;
export type ReadableOpts = NonNullable<
  ConstructorParameters<typeof Readable>[0]
>;
export type DuplexOpts = NonNullable<ConstructorParameters<typeof Duplex>[0]>;

interface StreamMockHd {
  destroy: Mock<[err: Error | null | undefined, cb: Callback], void>;
}
interface ReadableMockHd extends StreamMockHd {
  read: Mock<[size: number]>;
}
interface WritableMockHd extends StreamMockHd {
  final: Mock<[cb: Callback], void>;
  write: Mock<[chunk: Buffer, ec: string, cb: Callback], void>;
}
type DuplexMockHd = ReadableMockHd & WritableMockHd;

interface Construct {
  (cb: Callback): void;
}
export interface Callback {
  (err: Error | null): void;
}
