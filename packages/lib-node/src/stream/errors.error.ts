export function createAbortedError() {
  return new Error("Stream has bend aborted");
}
export function createNoMoreDataErr() {
  return new Error("Stream no more data");
}
export function createCallAheadError() {
  return new Error(
    "The previous Promise cannot be called again until it is resolved"
  );
}
