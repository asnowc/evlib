import { EventEmitter } from "node:events";

export type DEventEmitter = Omit<
    EventEmitter,
    | "removeListener"
    | "removeAllListeners"
    | "addListener"
    | "eventNames"
    | "rawListeners"
    | "prependListener"
    | "prependOnceListener"
>;
