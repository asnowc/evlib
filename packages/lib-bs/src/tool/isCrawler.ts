export function isCrawler() {
    if (navigator.webdriver === true) return true;
    const proto = Reflect.getPrototypeOf(navigator);
    if (proto !== Navigator.prototype) return true;
    let getter = Object.getOwnPropertyDescriptor(proto, "webdriver")?.get;
    if (!getter) return false;
    if (Function.toString.call(getter) !== "function get webdriver() { [native code] }") return true;
    else if (Function.prototype.toString.call(Function.toString) !== "function toString() { [native code] }")
        return true;

    return false;
}
