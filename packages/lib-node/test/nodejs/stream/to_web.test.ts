import { Readable, Duplex, Writable } from "node:stream";
import { describe, test, expect, vi } from "vitest";
import {
  createReadable,
  createWritable,
} from "../../stream/__mocks__/mock_stream.ts";
import { afterTime } from "evlib";

export type Stream = Duplex | Readable | Writable;
const data = Buffer.from("abc");
test("Readable.toWeb", async function () {
  const { mockOpts, stream } = createReadable({ highWaterMark: 5 });
  const readableStream = Readable.toWeb(stream);
  const reader = readableStream.getReader();
  stream.push(data);
  stream.push(data);
  stream.push(data);
  await afterTime();
  expect(
    stream.readableLength,
    "消费者实际并未读取, 造成 readable 扩大了 highWaterMark"
  ).toBe(3); // nodejs fix by v22
  stream.push(data);
  stream.push(data); //5 个chunk

  stream.push(data);
  stream.push(data);
  await afterTime();

  expect(
    stream.readableLength,
    "前3个 chunk 被缓存在 readableStream 的队列中, 剩下 5个 chunk 在 readable 的队列中"
  ).toBe(15);
});
test("Writable.toWeb", async function () {
  const mockWrite = vi.fn((a, b, cb) => afterTime(100).then(cb));
  const { mockOpts, stream } = createWritable({
    write: mockWrite,
    highWaterMark: 10,
  });
  expect(stream.writableObjectMode).toBeFalsy();
  const writableStream = Writable.toWeb(stream);
  const writer = writableStream.getWriter();
  writer.write(data);
  writer.write(data);
  expect(writer.desiredSize, "highWaterMark 成了 chunk 计数").toBe(8);
  await writer.write(data);
  expect(
    mockOpts.write,
    "mockWrite 异步写入,造成 第二次 write时 写入队列后直接 resolve"
  ).toBeCalledTimes(1);
  await writer.close();
});
