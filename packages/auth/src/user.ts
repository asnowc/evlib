type Auth = number | string;
type Id = string | number;
export abstract class Role<ID = void> extends Set<Auth> {
  abstract readonly id: ID;
  abstract name: string;
}

export abstract class User {
  readonly id: Id;
  abstract name: string;

  protected roleIdList = new Set<Id>();
  protected groupIdList = new Set<Id>();
  protected authList = new Set<Auth>();

  hasAuth(auth: Auth) {
    if (this.authList.has(auth)) return true;
    if (this.roleIsHasAuth(auth)) return true;
    if (this.groupIsHasAuth(auth)) return true;
    return false;
  }
  private roleIsHasAuth(auth: Auth): boolean {
    for (const id of this.roleIdList) {
      let role = this.getRoleById(id);
      if (role?.has(auth)) return true;
    }
  }
  private groupIsHasAuth(auth: Auth): boolean {
    for (const id of this.groupIdList) {
      let group = this.getUserById(id);
      if (group?.hasAuth(auth)) return true;
    }
    return false;
  }

  protected abstract getUserById(id: Id): User;
  protected abstract getRoleById(id: Id): Role;
}
