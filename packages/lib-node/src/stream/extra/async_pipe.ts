import { Duplex, Readable, Writable } from "node:stream";

type WithPromise<R extends {}, T = unknown> = Promise<T> & R;
/**
 * @beta
 */
export interface PipeOptions {
    /**
     * @remarks 当可读流结束时, 阻止目标的关闭
     * 对于 Writable, 相当于 end()
     * 对于 WritableStream, 相当于 close()
     */
    preventWritableEnd?: boolean;
    /**
     * @remarks 当可读流发生异常时, 阻止目标的中断
     * 对于 Writable, 相当于 destroy()
     * 对于 WritableStream, 相当于 abort()
     */
    preventWritableDispose?: boolean;
    /**
     * @remarks 当可写流发生异常时, 阻止可读流的中断
     * 对于 Writable, 相当于 destroy()
     * 对于 WritableStream, 相当于 cancel()
     */
    preventReadableDispose?: boolean;
}
/**
 * @beta
 * @throws PipeSourceError
 * @throws PipeTargetError
 * @throws Error 自定义中断异常
 */
export function pipeTo<T extends Readable, R extends Writable>(
    source: T,
    target: R,
    options: PipeOptions = {}
): WithPromise<{ abort(reason?: Error): void }, void> {
    let abort;
    const pms: WithPromise<{ abort(reason?: Error): void }, void> = new Promise<void>(function (resolve, reject) {
        target.on("unpipe", onFin).on("error", onTargetError);
        source.on("error", onSourceError);
        if (!source.readable) {
            const err = source.errored instanceof Error ? source.errored : new Error("Readable is ended");
            return onSourceError(err);
        }
        if (!target.writable) {
            const err = target.errored instanceof Error ? target.errored : new Error("Writable is ended");
            return onTargetError(err);
        }
        function onTargetError(err: Error) {
            clear();
            if (!options.preventReadableDispose && !source.destroyed) source.destroy(err);
            reject(new PipeTargetError(err));
        }
        function onSourceError(err: Error) {
            clear();
            if (!options.preventWritableDispose && !target.destroyed) target.destroy(err);
            reject(new PipeSourceError(err));
        }
        function onFin(this: Writable) {
            if (this.errored) {
                onTargetError(this.errored);
            } else {
                clear();
                resolve();
            }
        }
        function clear() {
            target.off("unpipe", onFin);
            setTimeout(function () {
                //需要在下一个宏任务移除error事件
                //因为当前可能处理 destroy , emit error 会在 nextTick 抛出
                target.off("error", onTargetError);
                source.off("error", onSourceError);
            });
        }
        abort = function abort(reason = new Error("Piping aborted")) {
            clear();
            if (!options.preventReadableDispose && !source.destroyed) source.destroy(reason);
            if (!options.preventWritableDispose && !target.destroyed) target.destroy(reason);
            reject(reason);
        };
        source.pipe(target, { end: !options.preventWritableEnd });
    }) as any;
    pms.abort = abort!;
    return pms;
}
/**
 * @beta
 * @remarks 桥接两个双工流。如果双方正常结束则resolve。如果某一方提前被 关闭/销毁，则reject
 * @throws BridgingError
 */
export function bridgingDuplex<A extends Duplex, B extends Duplex>(
    a: A,
    b: B,
    options: BridgingOptions = {}
): Promise<{ a: A; b: B }> {
    return new Promise(function (resolve, reject) {
        const { preventDispose } = options;
        const pipeOpts: PipeOptions = { preventReadableDispose: true, preventWritableDispose: true };
        const a_ctrl = pipeTo(a, b, pipeOpts);
        const b_ctrl = pipeTo(b, a, pipeOpts);

        Promise.all([a_ctrl, b_ctrl]).then(
            () => resolve({ a, b }),
            function (err) {
                let side = a.destroyed ? a : b;
                if (err instanceof PipeSourceError || err instanceof PipeTargetError) err = err.cause;
                if (!preventDispose) {
                    if (!a.destroyed) a.destroy(err);
                    if (!b.destroyed) b.destroy(err);
                }
                reject(new BridgingError(side, err));
            }
        );
    });
}

/** @public */
export interface BridgingOptions {
    /** @remarks 当发生异常时, 阻止销毁另一端 */
    preventDispose?: boolean;
}
/**
 * @public
 * @remarks 管道的源发生异常
 * @param side - 造成改 Duplex 异常的原因
 */
export class PipeSourceError extends Error {
    constructor(cause: Error) {
        super(cause.message ?? "source error", { cause });
    }
    declare cause: Error;
}
/**
 * @public
 * @remarks 管道的写入端发生异常
 * @param side - 造成改 Duplex 异常的原因
 */
export class PipeTargetError extends Error {
    constructor(cause: Error) {
        super(cause.message ?? "source error", { cause });
    }
    declare cause: Error;
}
/**
 * @public
 * @param side - 首先出现异常的 Duplex
 * @param side - 造成改 Duplex 异常的原因
 */
export class BridgingError extends Error {
    constructor(public side: Duplex, cause: Error) {
        super("bridging error", { cause });
    }
}
