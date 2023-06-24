export class PathMustBeAbs extends Error {
    constructor(public path: string) {
        super("路径必须是绝对路径: " + path);
    }
}
export class PathMustBeRel extends Error {
    constructor(public path: string) {
        super("路径必须是相对对路径: " + path);
    }
}
export class FileNotExist extends Error {
    constructor(public path: string) {
        super("文件不存在: " + path);
    }
}
export class TargetMustIsFile extends Error {
    constructor(public path: string) {
        super("目标必须是文件: " + path);
    }
}
