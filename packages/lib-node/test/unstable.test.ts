import { createReaderFromWebStream } from "@eavid/lib-node/unstable";
import { describe, test, expect } from "vitest";
import {
    ReadableStream,
    UnderlyingSource,
    ReadableStreamDefaultController,
    ByteLengthQueuingStrategy,
} from "node:stream/web";
describe("createReaderFromWebStream", function () {
    describe("取消reader", function () {
        test("cancel()", function () {
            const { cancel, read, stream, ctrl } = createMockRead();
            ctrl.enqueue(Buffer.allocUnsafe(4));
            ctrl.close();
            cancel();
            expect(cancel()).toBe(null);
        });
        test("缓存有剩余", async function () {
            const { read, cancel, ctrl } = createMockRead();
            ctrl.enqueue(Buffer.allocUnsafe(4));
            ctrl.close();
            await read(2);

            const val = cancel() as Buffer;
            expect(val!.byteLength).toBe(2);
        });
        test("缓存无剩余", async function () {
            const { cancel, read, ctrl } = createMockRead();
            ctrl.enqueue(Buffer.allocUnsafe(4));
            await read(4);
            expect(cancel()).toBe(null);
        });
    });
    function createMockRead() {
        const source = new MockSource();
        const stream = new ReadableStream<Uint8Array>(source, new ByteLengthQueuingStrategy({ highWaterMark: 0 }));
        const { read, cancel } = createReaderFromWebStream(stream);
        return {
            stream,
            ctrl: source.ctrl,
            read,
            cancel,
        };
    }
    class MockSource implements UnderlyingSource {
        ctrl!: ReadableStreamDefaultController;
        start(ctrl: ReadableStreamDefaultController) {
            this.ctrl = ctrl;
        }
    }
});
