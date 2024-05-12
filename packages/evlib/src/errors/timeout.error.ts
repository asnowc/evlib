/** 等待超时异常
 * @public
 */
export class TimeoutError extends Error {
  constructor(time?: number) {
    const msg = time !== undefined ? "Timeout" : "Timeout: " + time;
    super(msg);
  }
}
