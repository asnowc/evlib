import { ReadableStream, ReadableStreamDefaultReader } from "node:stream/web";

export interface TCP {}
export interface TTY {}
export interface UDP {}
export interface Pipe {}

export type Handle = TCP | TTY | UDP | Pipe;

async function readAll<T>(ctrl: ReadableStreamDefaultReader<T>): Promise<T[]> {
    const list: T[] = [];
    do {
        const chunk = await ctrl.read();
        if (chunk.done) return list;
        else list.push(chunk.value);
    } while (true);
}
let i = 10;
const rd = new ReadableStream(
    {
        pull(ctrl) {
            if (i >= 0) ctrl.enqueue(i--);
            else ctrl.close();
        },
    },
    { size: (chunk) => chunk.length }
);
const a = rd.getReader();
const list = await readAll(a);
console.log(list);
