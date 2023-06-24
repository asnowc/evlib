export let info: { engine: string; pathHome: string; equipment: string } = {} as any;
declare const window: any;
declare const __dirname: any;
declare const navigator: any;
try {
    window.window.window;
    info.engine = "Browser";
} catch (error) {
    info.engine = "NodeJs";
}
//环境检测
if (info.engine === "NodeJs") {
    info.pathHome = __dirname;
    info.equipment = "PC";
} else {
    if (/ipad|iphone|midp|rv:1.2.3.4|ucweb|android|windows ce|windows mobile/.test(navigator.userAgent.toLowerCase()))
        info.equipment = "mobile";
    else info.equipment = "PC";
}
