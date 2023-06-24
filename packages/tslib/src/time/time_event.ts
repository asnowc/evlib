export class TimeoutSignal extends AbortController {
    private id?: NodeJS.Timeout;
    constructor(timeout: number) {
        super();
        this.id = setTimeout(() => {
            if (!this.signal.aborted) this.abort();
        }, timeout);
    }
    abort(): void {
        if (this.id !== undefined) {
            clearTimeout(this.id);
            this.id = undefined;
        }
        super.abort();
    }
}

export class TimeoutController {
    private id?: NodeJS.Timeout;
    get called() {
        return this.id === undefined;
    }
    constructor(fx: () => void, timeout: number) {
        this.id = setTimeout(() => {
            this.id = undefined;
            fx();
        }, timeout);
    }
    abort() {
        if (this.id !== undefined) {
            clearTimeout(this.id);
            this.id = undefined;
        }
    }
}
class InterController {}
