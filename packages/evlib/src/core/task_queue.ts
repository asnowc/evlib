/**
 * @description 类Promise对象，串行等待n个微任务后 resolve
 */
export class AfterMicroTask {
    /**
     * @param count 指定的宏任务次数
     */
    constructor(private count = 1) {
        this.wait();
    }
    private wait() {
        if (this.count-- > 0) {
            queueMicrotask(() => this.wait());
        } else this.resolve();
    }
    private resolved = false;
    private resolve() {
        this.resolved = true;
        for (const fx of this.list) {
            try {
                fx();
            } catch (error) {
                console.error;
            }
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
/**
 * @description 类Promise对象，串行等待n个宏任务后 resolve
 */
export class AfterMacroTask {
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
