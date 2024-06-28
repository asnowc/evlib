/** @alpha */
export class InquiryRequest<
  AcceptReturn = unknown,
  RejectReturn = unknown,
  AcceptArgs extends any[] = [],
  RejectArgs extends any[] = [],
> {
  constructor(
    acceptCb: (...args: AcceptArgs) => AcceptReturn,
    rejectCb: (...args: RejectArgs) => RejectReturn,
  ) {
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
