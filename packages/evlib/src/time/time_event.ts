import { TimeoutError } from "../errors/time.error.js";

/**
 * @description 超时控制器，超时将自动执行 abort()
 */
export class TimeoutController extends AbortController {
    private id?: number;
    constructor(timeout: number) {
        super();
        this.id = setTimeout(() => {
            if (!this.signal.aborted) this.abort();
        }, timeout);
    }
    /**
     * @description 如果在超时前执行abort，则将自动取消超时执行
     */
    abort(): void {
        this.clear();
        (super.abort as any)(new TimeoutError());
    }
    /** 取消超时执行 */
    clear() {
        clearTimeout(this.id);
        this.id = undefined;
    }
}
/**
 * @description 超时执行函数。返回一个取消的句柄
 * @param fx 超时的回调
 * @param timeout 超时时间，单位毫秒。这将会被传入setTimeout
 * @returns 返回一个函数，可用取消超时执行
 */
export function createTimeoutHandle(fx: () => void, timeout: number) {
    let id: number | undefined;
    id = setTimeout(() => {
        id = undefined;
        fx();
    }, timeout);
    return function clear() {
        clearTimeout(id);
    };
}
