class Restrictor {
    //限流器
    #interval = 0; //内部数据，流量触发上限
    get interval() {
        return this.#interval;
    }
    set interval(val) {
        this.#interval = val;
    }
    #intervalCount = 0; //内部数据，流量次数统计
    get intervalCount() {
        return this.#intervalCount;
    } //获取当前流量触发次数
    get intervalEnd() {
        return this.#intervalCount >= this.#interval;
    }
    //流量是否达到
    triggerInterval(reset: boolean) {
        //触发流量
        if (++this.#intervalCount >= this.#interval) {
            if (reset) this.#interval = 0;
            return true;
        } else return false;
    }

    #time = 0; //内部数据，时间间隔限制
    get time() {
        return this.#time;
    }
    set time(val) {
        this.#time = val;
        this.#triggerTime = new Date();
    }
    #triggerTime: Date = new Date(); //上次触发时间
    get timeRemaining(): number {
        return (new Date() as unknown as number) - (this.#triggerTime as unknown as number);
    } //获取剩余时间
    get timeEnd() {
        return this.timeRemaining >= this.#time;
    } //流量是否达到
    triggerTime(reset = true) {
        //触发流量
        if (this.timeEnd) {
            if (reset) this.#triggerTime = new Date();
            return true;
        } else return false;
    }
}
