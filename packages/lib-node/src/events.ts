import { EventEmitter } from "node:events";
import { Listenable } from "evlib";

export function toListenable<T extends any[]>(eventEmitter: EventEmitter, name: string) {
    const listable = new Listenable<T>();
    eventEmitter.on(name, function (this: EventEmitter, ...args) {
        listable.emit(args as T);
    });
    return listable;
}
