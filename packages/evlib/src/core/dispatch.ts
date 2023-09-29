import { setTimeout, clearTimeout } from "./internal.js";
/**
 * @remarks 类Promise对象，串行等待n个微任务后 resolve
 */
class AfterMicroTask {
    /**
     * @param count 指定的宏任务次数
     */
    constructor(private count = 1) {
        this.wait();
    }
    private wait = () => {
        if (this.count-- > 0) {
            microTask.then(this.wait);
        } else this.resolve();
    };
    private resolved = false;
    private resolve() {
        this.resolved = true;
        for (const fx of this.list) {
            try {
                fx();
            } catch (error) {}
        }
        this.list = [];
    }
    private list: (() => void)[] = [];
    then(fx: () => any) {
        if (this.resolved) fx();
        else this.list.push(fx);
        return this;
    }
}
const microTask = Promise.resolve();

/**
 * @remarks 类Promise对象，串行等待n个宏任务后 resolve
 */
class AfterMacroTask {
    /**
     * @param count 指定的宏任务次数
     */
    constructor(private count = 1) {
        this.wait(this);
    }
    private wait(_this: AfterMacroTask) {
        if (_this.count-- > 0) setTimeout(_this.wait, 0, _this);
        else _this.resolve();
    }
    private resolved = false;
    private resolve() {
        this.resolved = true;
        for (const fx of this.list) {
            fx();
        }
        this.list = [];
    }
    private list: (() => void)[] = [];
    then(fx: () => any) {
        if (this.resolved) fx();
        else this.list.push(fx);
    }
}

/**
 * @public
 * @remarks 超时执行函数。返回一个取消的句柄
 * @param fn - 超时的回调
 * @param timeout - 超时时间，单位毫秒。这将会被传入setTimeout
 * @returns 返回一个函数，可用取消超时执行
 */
export function createTimeoutHandle(fn: () => void, timeout: number = 0) {
    let id: number | undefined;
    id = setTimeout(function () {
        id = undefined;
        fn();
    }, timeout);
    return function clear() {
        clearTimeout(id);
    };
}
/**
 * @public
 * @remarks 返回一个promise, 在指定时间后 resolve
 */
export function afterTime(time?: number) {
    return new Promise<void>((resolve, reject) => setTimeout(resolve, time));
}

/**
 * @alpha
 * @remarks 超时控制器，超时将自动执行 abort()
 */
//class TimeoutController extends AbortController {
//    private id?: number;
//    constructor(timeout: number) {
//        super();
//        this.clear = createTimeoutHandle(() => {
//            this.abort();
//        }, timeout);
//    }
//    /**
//     * @description 如果在超时前执行abort，则将自动取消超时执行
//     */
//    abort(): void {
//        this.clear();
//        (super.abort as any)(new TimeoutError());
//    }
//    /** 取消超时执行 */
//    clear: VoidFunction;
//}
