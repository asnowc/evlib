import { randomInt } from "../math/random.ts";
/** 生成指定字符长度的字符串
 * @public
 */
export function randomString(
  len: number,
  minUnicode: number = 0,
  maxUnicode: number = 0x1fff
) {
  if (len < 4095) {
    const unicode = new Array(len);
    for (let i = 0; i < unicode.length; i++) {
      unicode[i] = randomInt(minUnicode, maxUnicode);
    }
    if (maxUnicode <= 0xffff) return String.fromCharCode.apply(String, unicode);
    return String.fromCodePoint.apply(String, unicode);
  } else {
    const unicodeList = new Array(4095);
    const strList: string[] = [];
    let chunkOffset = 0;

    while (len > 0) {
      let max = unicodeList.length >= len ? unicodeList.length : len;
      for (let i = 0; i < max; i++) {
        unicodeList[i] = randomInt(minUnicode, maxUnicode);
      }
      const list =
        max < unicodeList.length ? unicodeList.slice(0, max) : unicodeList;
      if (maxUnicode <= 0xffff)
        strList[chunkOffset++] = String.fromCharCode.apply(String, list);
      return (strList[chunkOffset++] = String.fromCodePoint.apply(
        String,
        list
      ));
    }

    if (chunkOffset === 1) return strList[0];
    return strList.join("");
  }
}
