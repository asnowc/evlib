/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x: number, y: number) {
    var lsw = (x & 0xffff) + (y & 0xffff);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
}

/** Bitwise rotate a 32-bit number to the left.*/
const bit_rol = (num: number, cnt: number) => (num << cnt) | (num >>> (32 - cnt));

type Md5e = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => number;

/** These functions implement the four basic operations the algorithm uses. */
const md5_cmn = (q: number, a: number, b: number, x: number, s: number, t: number) =>
    safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
const md5_ff: Md5e = (a, b, c, d, x, s, t) => md5_cmn((b & c) | (~b & d), a, b, x, s, t);
const md5_gg: Md5e = (a, b, c, d, x, s, t) => md5_cmn((b & d) | (c & ~d), a, b, x, s, t);
const md5_hh: Md5e = (a, b, c, d, x, s, t) => md5_cmn(b ^ c ^ d, a, b, x, s, t);
const md5_ii: Md5e = (a, b, c, d, x, s, t) => md5_cmn(c ^ (b | ~d), a, b, x, s, t);

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
function core_md5(x: number[], len: number) {
    /* append padding */
    x[len >> 5] |= 0x80 << len % 32;
    x[(((len + 64) >>> 9) << 4) + 14] = len;

    var a = 1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d = 271733878;

    for (var i = 0; i < x.length; i += 16) {
        var olda = a;
        var oldb = b;
        var oldc = c;
        var oldd = d;

        a = md5_ff(a, b, c, d, x[i + 0], 7, -680876936);
        d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
        b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);

        a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = md5_gg(b, c, d, a, x[i + 0], 20, -373897302);
        a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

        a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
        d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = md5_hh(d, a, b, c, x[i + 0], 11, -358537222);
        c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);

        a = md5_ii(a, b, c, d, x[i + 0], 6, -198630844);
        d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);

        a = safe_add(a, olda);
        b = safe_add(b, oldb);
        c = safe_add(c, oldc);
        d = safe_add(d, oldd);
    }
    return Array(a, b, c, d);
}

var b64pad = ""; /* base-64 pad character. "=" for strict RFC compliance   */

/**
 * Convert a string to an array of little-endian words
 * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
 *
 * @param chrsz bits per input character. 8 - ASCII; 16 - Unicode
 */
function str2binl(str: string, chrsz: number) {
    var bin = Array<number>();
    var mask = (1 << chrsz) - 1;
    for (var i = 0; i < str.length * chrsz; i += chrsz) bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << i % 32;
    return bin;
}

/** Convert an array of little-endian words to a string */
function binl2str(bin: number[], chrsz: number) {
    var str = "";
    var mask = (1 << chrsz) - 1;
    for (var i = 0; i < bin.length * 32; i += chrsz) str += String.fromCharCode((bin[i >> 5] >>> i % 32) & mask);
    return str;
}

/**
 * @description Convert an array of little-endian words to a hex string.
 * @param uppercase 是否转为大小写
 */
function binl2hex(binarray: number[], uppercase?: boolean) {
    var hex_tab = uppercase ? "0123456789ABCDEF" : "0123456789abcdef";
    var str = "";
    for (var i = 0; i < binarray.length * 4; i++) {
        str +=
            hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) +
            hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xf);
    }
    return str;
}

/** Convert an array of little-endian words to a base-64 string */
function binl2b64(binarray: number[], b64pad: string) {
    var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var str = "";
    for (var i = 0; i < binarray.length * 4; i += 3) {
        var triplet =
            (((binarray[i >> 2] >> (8 * (i % 4))) & 0xff) << 16) |
            (((binarray[(i + 1) >> 2] >> (8 * ((i + 1) % 4))) & 0xff) << 8) |
            ((binarray[(i + 2) >> 2] >> (8 * ((i + 2) % 4))) & 0xff);
        for (var j = 0; j < 4; j++) {
            if (i * 8 + j * 6 > binarray.length * 32) str += b64pad;
            else str += tab.charAt((triplet >> (6 * (3 - j))) & 0x3f);
        }
    }
    return str;
}

type Md5Encode = "hex" | "str" | "base64";
interface EncodeOptions {
    encode?: Md5Encode;
    /** bits per input character. 8 - ASCII; 16 - Unicode. 默认为 8;  仅在 encode 为 str 时有效 */
    chrsz?: 8 | 16;
    /** 仅在 encode 为 hex 时有效 */
    hexUppercase?: boolean;
    /** 仅在 encode 为 base64 时有效 */
    b64pad?: string;
}
export function md5(data: string, options: EncodeOptions = {}) {
    const { chrsz = 8, hexUppercase, b64pad = "", encode = "hex" } = options;
    let rawHash = core_md5(str2binl(data, chrsz), data.length * chrsz);

    switch (encode) {
        case "hex":
            return binl2hex(rawHash, hexUppercase);
        case "base64":
            return binl2b64(rawHash, b64pad);
        case "str":
            return binl2str(rawHash, chrsz);
        default:
            throw new Error(`encode "${encode}" is not support`);
    }
}

/** Calculate the HMAC-MD5, of a key and some data */
export function hmac_md5(data: string, key: string, options: EncodeOptions = {}) {
    const { chrsz = 8, encode = "hex", b64pad = "", hexUppercase } = options;

    let bkey = str2binl(key, chrsz);
    if (bkey.length > 16) bkey = core_md5(bkey, key.length * chrsz);

    const ipad = Array(16),
        opad = Array(16);
    for (let i = 0; i < 16; i++) {
        ipad[i] = bkey[i] ^ 0x36363636;
        opad[i] = bkey[i] ^ 0x5c5c5c5c;
    }

    const hash = core_md5(ipad.concat(str2binl(data, chrsz)), 512 + data.length * chrsz);
    const rawHash = core_md5(opad.concat(hash), 512 + 128);

    switch (encode) {
        case "hex":
            return binl2hex(rawHash, hexUppercase);
        case "base64":
            return binl2b64(rawHash, b64pad);
        case "str":
            return binl2str(rawHash, chrsz);
        default:
            throw new Error(`encode "${encode}" is not support`);
    }
}
