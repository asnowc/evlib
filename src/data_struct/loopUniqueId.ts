/**
 * 循环唯一生成唯一id
 * @remarks 从 min 到 max 递增，当 达到max 从 min 重新开始
 * @public
 */
export class LoopUniqueId {
  constructor(public min = 0, public max = 2147483648) {
    this.#value = min;
  }
  #value: number;
  /** 生成下一个id */
  next() {
    let v = this.#value;
    if (v >= this.max) this.#value = this.min;
    else this.#value++;
    return v;
  }
  reset() {
    this.#value = this.min;
  }
}
