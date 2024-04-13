/**
 * 部分API 虽然是在web、node、deno端都有实现，但并不是JavaScript标准API，所以必须设置
 */

let global = globalThis as any;
export let setTimeout: InitFn["setTimeout"] = typeof global.setTimeout ? global.setTimeout : unimplemented;
export let setInterval: InitFn["setInterval"] = typeof global.setInterval ? global.setInterval : unimplemented;
export let clearTimeout: InitFn["clearTimeout"] = typeof global.clearTimeout ? global.clearTimeout : unimplemented;
export let clearInterval: InitFn["clearInterval"] = typeof global.clearInterval ? global.clearInterval : unimplemented;

interface InitFn {
  clearInterval(id: number | undefined): void;
  clearTimeout(id: number | undefined): void;

  setInterval(handler: TimerHandler, timeout?: number, ...args: any[]): number;
  setTimeout(handler: TimerHandler, timeout?: number, ...args: any[]): number;
}

type TimerHandler = string | Function;

function unimplemented() {
  throw new Error("Function not implemented");
}
export interface BaseAbortSignal {
  readonly aborted: boolean;
  readonly reason: any;
  addEventListener(type: string, listener: EventListenerObject, options?: { once?: boolean }): void;
  removeEventListener(type: string, listener: EventListenerObject): void;
}
export interface EventListenerObject {
  handleEvent(object: unknown): void;
}
