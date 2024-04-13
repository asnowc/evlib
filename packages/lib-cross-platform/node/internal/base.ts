const nav = navigator;
type platform =
  | "aix"
  | "darwin"
  | "freebsd"
  | "linux"
  | "openbsd"
  | "sunos"
  | "win32"
  | "android"
  | "unknown";
export function platform(): platform {
  var UAData = (nav as any).userAgentData;
  let uaPlatform = UAData.platform;
  switch (uaPlatform) {
    case "Windows":
      return "win32";
    case "":
      return "unknown";
  }
  let pt = nav.platform;
  return <platform>pt.toLowerCase();
}
export { platform as osPlatform };
export function cwd() {
  return "C:";
}
const mainDir = (function () {
  let hf = decodeURI(location.href);
})();
