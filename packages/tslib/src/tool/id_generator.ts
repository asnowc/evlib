/** 自动唯一key自动映射映射 */
export class IdGeneratorMap<T> extends Map<number, T> {
    private id: number;
    private revokeIds = new Set<number>();
    constructor(private revokePoolLen: number, private min = 0, private max = Infinity) {
        super();
        this.id = min;
    }
    /** 存储数据, 返回数据的key */
    next(val: T) {
        for (const id of this.revokeIds) {
            this.revokeIds.delete(id);
            this.set(id, val);
            return id;
        }
        if (this.size > this.max) throw "id耗尽";
        let next: number;
        do {
            next = this.id++;
            if (next > this.max) this.id = this.min;
        } while (this.has(next));
        super.set(next, val);
        return next;
    }

    /** 删除key 同时回收id */
    delete(id: number): boolean {
        if (super.delete(id)) {
            if (this.revokeIds.size < this.revokePoolLen) this.revokeIds.add(id);
            return true;
        }
        return false;
    }
    /** 获取id对于的数据,同时回收id */
    take(id: number) {
        let val = this.get(id);
        this.delete(id);
        return val;
    }
    set(id: number, value: T): this {
        if (id >= this.min && id <= this.max) {
            this.revokeIds.delete(id);
            super.set(id, value);
        }
        return this;
    }
    clear() {
        super.clear();
        this.revokeIds.clear();
        this.id = this.min;
    }
}

export class IdGeneratorSet extends Set<number> {
    private id: number;
    private revokeIds = new Set<number>();
    constructor(private revokePoolLen: number, private min = 0, private max = Infinity) {
        super();
        this.id = min;
    }
    next() {
        for (const id of this.revokeIds) {
            this.revokeIds.delete(id);
            return id;
        }
        if (this.size > this.max) throw "id耗尽";
        let next: number;
        do {
            next = this.id++;
            if (next > this.max) this.id = this.min;
        } while (this.has(next));
        super.add(next);
        return next;
    }
    delete(id: number): boolean {
        if (super.delete(id)) {
            if (this.revokeIds.size < this.revokePoolLen) this.revokeIds.add(id);
            return true;
        }
        return false;
    }
    add(id: number): this {
        if (id >= this.min && id <= this.max) {
            this.revokeIds.delete(id);
            super.add(id);
        }

        return this;
    }
    clear() {
        this.id = this.min;
        super.clear();
        this.revokeIds.clear();
    }
}
