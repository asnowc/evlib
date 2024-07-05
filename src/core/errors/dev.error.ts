/** @public */
export class NotImplementedError extends Error {
  constructor(type: string = "") {
    super(type + "not implemented");
  }
}
