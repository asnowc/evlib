import { Dir, DirInfo, DirInfoContent } from "./chuck.js";
import * as Path from "node:path";

export interface DriveInfo {
  root?: string;
}
export class Drive {
  static createRootDir() {
    return new this().root;
  }
  get size() {
    return this.root.size;
  }
  readonly info: Readonly<DriveInfo>;
  readonly root: Dir;
  constructor(dirInfo: DirInfo | DirInfoContent = {}, info: DriveInfo = {}) {
    this.info = info;
    this.root = new Dir(
      { name: Path.resolve("/"), parent: null, root: null },
      dirInfo,
    );
  }
}
