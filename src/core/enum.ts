/** @alpha */
export const Enum = {
  getKeys(enumObj: Record<string, string | number>): string[] {
    let keys = Object.keys(enumObj);

    let resultKeys: string[] = [];
    for (const key of keys) {
      if (/(\D)|(^0.)/.test(key)) resultKeys.push(key);
    }
    return resultKeys;
  },
};
