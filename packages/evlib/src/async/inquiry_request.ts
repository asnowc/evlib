export class InquiryRequest<
    AcceptReturn = unknown,
    RejectReturn = unknown,
    AcceptArgs extends any[] = [],
    RejectArgs extends any[] = []
> {
    constructor(acceptCb: (...args: AcceptArgs) => AcceptReturn, rejectCb: (...args: RejectArgs) => RejectReturn) {
        this.#acceptCb = acceptCb;
        this.#rejectCb = rejectCb;
    }
    #acceptCb?: (...args: AcceptArgs) => AcceptReturn;
    #rejectCb?: (...args: RejectArgs) => RejectReturn;
    /** true: 已接受，false：已拒绝 */
    #status?: boolean;
    get status() {
        return this.#status;
    }
    private fin(status: boolean) {
        this.#status = status;
        this.#acceptCb = undefined;
        this.#rejectCb = undefined;
    }
    accept(...args: AcceptArgs): AcceptReturn {
        if (this.#acceptCb) {
            const cb = this.#acceptCb;
            this.fin(true);
            return cb(...args);
        }
        throw "状态不可逆";
    }
    reject(...args: RejectArgs): RejectReturn {
        if (this.#rejectCb) {
            const cb = this.#rejectCb;
            this.fin(false);
            return cb(...args);
        }
        throw "状态不可逆";
    }
}

interface Resolve<T> {
    (value: T | PromiseLike<T>): void;
}
type Reject = (reason?: any) => void;

export class PromiseHandle<Res = void, Rej = void> implements Promise<Res> {
    constructor() {
        let tResolve!: Resolve<Res>, tReject!: Reject;
        let pms = new Promise<Res>(function (resolve, reject) {
            tResolve = resolve;
            tReject = reject;
        });
        this.#resolve = tResolve;
        this.#reject = tReject;
        this.promise = pms;
        this[Symbol.toStringTag] = pms[Symbol.toStringTag];
    }
    readonly promise: Promise<Res>;
    #resolve?;
    #reject?;
    status?: boolean;

    resolve(arg: Res) {
        if (this.#resolve) {
            this.#resolve(arg);
            this.#reject = undefined;
            this.#resolve = undefined;
            this.status = true;
        }
    }
    reject(err: Rej): void {
        if (this.#reject) {
            this.#reject(err);
            this.#reject = undefined;
            this.#resolve = undefined;
            this.status = false;
        }
    }

    then<TResult1 = Res, TResult2 = never>(
        onfulfilled?: ((value: Res) => TResult1 | PromiseLike<TResult1>) | null | undefined,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
    ): Promise<TResult1 | TResult2> {
        return this.promise.then(onfulfilled, onrejected);
    }
    catch<TResult = never>(
        onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined
    ): Promise<Res | TResult> {
        return this.promise.catch(onrejected);
    }
    finally(onfinally?: (() => void) | null | undefined): Promise<Res> {
        return this.promise.finally(onfinally);
    }
    [Symbol.toStringTag]!: string;

    /**
     * @param cancelOther 如果为true, 当列表中第一个失败后, 将 reject 其余 waiting 状态的PromiseHandle
     */
    static all<T extends PromiseHandle<any, any>>(values: Iterable<T>, cancelOther?: boolean): Promise<Awaited<T>[]>;
    static all<T extends PromiseHandle<any, any>>(values: T[], cancelOther?: boolean): Promise<Awaited<T>[]>;
    static all<T extends PromiseHandle<any, any>>(values: readonly T[], cancelOther = false): Promise<Awaited<T>[]> {
        let cache = [...values];
        let pms = Promise.all(values);
        pms.catch((val) => {
            for (const pHandle of cache) pHandle.reject(val);
            return val;
        });
        return pms;
    }

    static resolve(): PromiseHandle;
    static resolve<T>(value: T): PromiseHandle<T>;
    static resolve(value?: unknown): PromiseHandle<any> {
        let pmsHandle = new this<unknown>();
        pmsHandle.resolve(value);
        return pmsHandle;
    }

    static reject(): PromiseHandle;
    static reject<T>(value?: T): PromiseHandle<T>;
    static reject(value?: any): Promise<any> {
        let pmsHandle = new this<unknown>();
        pmsHandle.reject(value);
        return pmsHandle;
    }
}

export class TimeoutPromise extends PromiseHandle {
    private timeoutId?: number;
    constructor(timeout: number, reject = false) {
        super();
        this.timeoutId = setTimeout(reject ? this.reject.bind(this) : this.resolve.bind(this), timeout);
    }
    resolve(arg: void): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
        super.resolve(arg);
    }
    reject(err?: any): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
        super.reject(err);
    }
}
export type Rejected<T extends PromiseHandle> = T extends PromiseHandle<any, infer P> ? P : never;
let a = new PromiseHandle();
a.status = true;
