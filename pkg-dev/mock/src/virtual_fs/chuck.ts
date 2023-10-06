import * as Path from "node:path";
import { Stats } from "node:fs";
import * as error from "./err/index.js";

export enum ChunkType {
    file,
    dir,
    link,
}
export interface Metadata {
    name: string;
    parent: Dir | null;
    root: Dir | null;
}

export abstract class Chuck {
    static Stats = class Stats {
        constructor(info: Partial<StatsBase>, chuck: Chuck) {
            Object.assign(this, info);
            this.#type = chuck.type;
        }
        #type: ChunkType;
        isFile() {
            return this.#type === ChunkType.file;
        }
        isDirectory() {
            return this.#type === ChunkType.dir;
        }
        isBlockDevice() {
            return false;
        }
        isCharacterDevice() {
            return false;
        }
        isSymbolicLink() {
            return this.#type === ChunkType.link;
        }
        isFIFO() {
            return false;
        }
        isSocket() {
            return false;
        }
    };
    abstract readonly type: ChunkType;
    abstract readonly size: number;

    protected readonly name: string;
    protected readonly parent: Dir | null;
    protected readonly root: Dir | null;

    /** 返回相对于父级dir的相对目录，如果dir不是当前chuck的父级，将返回绝对路径*/
    getRelativePath(dir: Dir) {
        let pt = this.name;
        let parent = this.parent;
        while (parent) {
            pt = parent.name + Path.sep + pt;
            if (parent === dir) return pt;
        }
        return pt;
    }

    getChunkFromPath(path: string): Chuck | undefined {
        const { root } = Path.parse(path);
        if (root !== "") return this.root?.getChildChuck(Path.relative(root, path));
        else {
            if (this instanceof Dir) return this.getChildChuck(path);
            else {
                path = Path.join(path);
                if (path.startsWith("..")) return this.parent?.getChildChuck(path.slice(3));
                return;
            }
        }
    }
    stat(): Stats {
        return new Chuck.Stats({ ...this.statsTime, ...this.staticStats }, this) as any as Stats;
    }
    get path() {
        let parent = this.parent;
        let pt = this.name;
        while (parent) {
            if (parent.name === "/") pt = "/" + pt;
            else pt = parent.name + Path.sep + pt;
            parent = parent.parent;
        }
        return pt;
    }
    staticStats: Partial<StatsBase>;
    protected readonly statsTime: StatsTime; //文件操作的世界信息
    constructor(protected readonly metadata: Readonly<Metadata>, staticStats?: Partial<StatsBase>) {
        if (!/[^*?]+/.test(metadata.name)) {
            throw "name不符合规范";
        }
        this.name = metadata.name;
        this.parent = metadata.parent;
        this.root = metadata.root;
        this.statsTime = {
            atime: new Date(),
            birthtime: new Date(),
            ctime: new Date(),
            mtime: new Date(),
        };
        this.staticStats = { ...staticStats };
    }
}

export class Dir extends Chuck {
    type = ChunkType.dir;
    protected content = new Map<string, Chuck>();

    constructor(metadata: Metadata, info: Readonly<DirInfo> | Readonly<DirInfoContent>) {
        let dirInfo: Readonly<DirInfo>;
        if (!info["*type"]) dirInfo = { "*type": ChunkType.dir, content: info as DirInfoContent };
        else dirInfo = info as DirInfo;

        super(metadata, dirInfo.staticStat);
        if (!this.root) (this as any).root = this;

        Object.assign(this.statsTime, dirInfo.defaultStatTime);
        let content = dirInfo.content ?? {};
        for (const key of Object.keys(content)) this.appendChuck(key, content[key]);
    }
    appendChuck(name: string, val: FileInfo | Buffer): File;
    appendChuck(name: string, val: string | LinkInfo): SymbolicLink;
    appendChuck(name: string, val: DirInfo | DirInfoContent): Dir;
    appendChuck(name: string, val: DirInfoContentVal): Chuck;
    appendChuck(name: string, val: DirInfoContentVal) {
        const metadata = { name, parent: this, root: this.root };
        let newChuck: Chuck;
        if (typeof val === "string") newChuck = new SymbolicLink(metadata, val);
        else if (val instanceof Buffer) newChuck = new File(metadata, val);
        else {
            const infoType = val["*type"];
            switch (infoType) {
                case ChunkType.file:
                    newChuck = new File(metadata, val);
                    break;
                case ChunkType.link:
                    newChuck = new SymbolicLink(metadata, val);
                    break;
                default: //dir
                    newChuck = new Dir(metadata, val);
                    break;
            }
        }
        this.content.set(name, newChuck);
        return newChuck;
    }
    /** 删除子块 */
    removeChuck(name: string) {
        let item = this.content.get(name);
        if (item) this.content.delete(name);
    }
    clearChuck() {
        this.content.clear();
    }

    /** 获取路径的 mock 文件 ,  路径是相对于当前 dir*/
    getChildChuck(path: string) {
        return this.parsePath(path, true);
    }
    /** 获取当前路径下的直接chuck */
    getChildChucks() {
        let res: Record<string, Chuck> = {};
        for (const [key, val] of this.content) {
            res[key] = val;
        }
        return res;
    }
    private parsePath(relPt: string, resultOnly: true): Chuck | undefined;
    private parsePath(relPt: string, resultOnly?: false): [Dir, string] | undefined;
    private parsePath(relPt: string, resultOnly?: boolean): [Dir, string] | Chuck | undefined {
        if (Path.isAbsolute(relPt)) throw new Error("参数必须是相对路径");
        const dirList = Path.join(relPt).split(Path.sep);
        let current: Dir = this;
        let last = dirList.pop()!;
        for (let i = 0; i < dirList.length; i++) {
            let step = dirList[i];
            let next = current.content.get(step);
            if (!(next && next instanceof Dir)) return;
            current = next;
        }
        if (resultOnly) return current.content.get(last);
        return [current, last];
    }

    get size() {
        let size = 0;
        for (const [, item] of this.content) {
            if (item instanceof SymbolicLink) {
                //todo: link大小计算
                size += item.target?.size ?? 0;
            } else size += item.size;
        }
        return size;
    }
    /** 确保目录存在，不存在则创建 */
    ensure(relPt: string): Dir {
        if (Path.isAbsolute(relPt)) throw new Error("relPt必须是相对对路径");
        relPt = Path.join(relPt);
        let current: Dir = this;
        for (const item of relPt.split(Path.sep)) {
            if (!this.content.has(item)) current = current.appendChuck(item, {});
        }
        return current;
    }
    mkdir(name: string) {
        return this.appendChuck(name, {});
    }
    readdir() {
        return this.content.keys();
    }
    appendFile(name: string) {
        return this.appendChuck(name, File.emptyFile);
    }

    /** mock 执行 */

    async exists(pt: string) {
        return this.existsSync(pt);
    }
    existsSync(pt: string) {
        try {
            return !!this.parsePath(pt, true);
        } catch (error) {
            return false;
        }
    }
    async readFile(...args: Parameters<typeof this["readFileSync"]>) {
        return this.readFileSync.apply(this, args);
    }
    readFileSync(pt: string, encoding?: BufferEncoding) {
        const res = this.parsePath(pt);
        if (!res) throw new error.FileNotExist(pt);
        const file = res[0].content.get(res[1]);
        if (!file) throw new error.FileNotExist(pt);

        if (file.type === ChunkType.file || file.type === ChunkType.link) {
            let buffer = (file as File).read();
            return encoding ? buffer.toString(encoding) : buffer;
        } else throw new error.TargetMustIsFile(pt);
    }

    mkdirSync() {}
}

export class File extends Chuck {
    static emptyFile: FileInfo = { "*type": ChunkType.file };

    type = ChunkType.file;
    protected content: Buffer;
    get size() {
        return this.content.byteLength;
    }

    constructor(metadata: Metadata, info: FileInfo | FileInfoContent);
    constructor(metadata: Metadata, hardLinkTarget: File);
    constructor(metadata: Metadata, info?: FileInfo | FileInfoContent | File) {
        super(metadata);

        let content: Buffer;
        if (info instanceof File) content = info.content;
        else {
            if (typeof info === "string" || info instanceof Buffer) content = Buffer.from(info);
            else content = Buffer.from(info?.content ?? []);
        }

        this.content = content;
    }
    read(offset = 0, length?: number): Buffer {
        return Buffer.from(this.content.subarray(offset, length));
    }
    write(bf: Buffer, offset = 0) {
        this.content.set(bf, offset);
    }
    append(data: Buffer) {}
}

export class SymbolicLink extends File {
    readonly type = ChunkType.link;
    targetPath: string;
    get target(): Chuck | undefined {
        return this.getChunkFromPath(this.targetPath);
    }
    constructor(metadata: Metadata, info: LinkInfo | string) {
        super(metadata, "");
        if (typeof info === "string") this.targetPath = info;
        else {
            this.targetPath = info.target;
        }
    }
}

export interface ChunkInfo {
    /** 优先级最高 */
    staticStat?: Partial<StatsBase>;

    defaultStatTime?: Partial<StatsTime>;
}
/**
 * string为link 格式: hard:// soft:// symbol://
 * Buffer为file
 */
type DirInfoContentVal = DirInfoContent | DirInfo | LinkInfo | FileInfo | Buffer | string;
export interface DirInfo extends ChunkInfo {
    "*type": ChunkType.dir;
    content?: DirInfoContent;
}

type FileInfoContent = string | Buffer;
export type DirInfoContent = {
    [key: string | number]: DirInfoContentVal;
};

export interface FileInfo extends ChunkInfo {
    "*type": ChunkType.file;
    content?: FileInfoContent;
}

export interface LinkInfo extends ChunkInfo {
    "*type": ChunkType.link;
    target: string;
}

export type StatsBase = {
    [key in keyof Stats as key extends `is${string}` ? never : key]: Stats[key];
};
interface StatsTime {
    atime: Date;
    mtime: Date;
    ctime: Date;
    birthtime: Date;
}
