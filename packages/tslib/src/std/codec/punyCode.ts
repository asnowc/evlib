let initial_n = 0x80;
let initial_bias = 72;
let delimiter = "\x2D";
let base = 36;
let damp = 700;
let tmin = 1;
let tmax = 26;
let skew = 38;
let maxInt = 0x7fffffff;
function decode_digit(cp: number) {
    return cp - 48 < 10 ? cp - 22 : cp - 65 < 26 ? cp - 65 : cp - 97 < 26 ? cp - 97 : base;
}

function encode_digit(d: number, flag: number) {
    return d + 22 + 75 * (d < 26 ? 1 : 0) - ((flag != 0 ? 1 : 0) << 5);
}
function adapt(delta: number, numpoints: number, firsttime: number) {
    let k;
    delta = firsttime ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numpoints);

    for (k = 0; delta > ((base - tmin) * tmax) >> 1; k += base) {
        delta = Math.floor(delta / (base - tmin));
    }
    return Math.floor(k + ((base - tmin + 1) * delta) / (delta + skew));
}

function encode_basic(bcp: number, flag: number) {
    bcp -= (bcp - 97 < 26 ? 1 : 0) << 5;
    return bcp + ((!flag && bcp - 65 < 26 ? 1 : 0) << 5);
}
const utf16 = {
    decode: function (input: string): number[] {
        let output: number[] = [],
            i = 0,
            len = input.length,
            value,
            extra;
        while (i < len) {
            value = input.charCodeAt(i++);
            if ((value & 0xf800) === 0xd800) {
                extra = input.charCodeAt(i++);
                if ((value & 0xfc00) !== 0xd800 || (extra & 0xfc00) !== 0xdc00) {
                    throw new RangeError("UTF-16(decode): Illegal UTF-16 sequence");
                }
                value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
            }
            output.push(value);
        }
        return output;
    },
    encode: function (input: number[]): string {
        let output: string[] = [],
            i = 0,
            len = input.length,
            value;
        while (i < len) {
            value = input[i++];
            if ((value & 0xf800) === 0xd800) {
                throw new RangeError("UTF-16(encode): Illegal UTF-16 value");
            }
            if (value > 0xffff) {
                value -= 0x10000;
                output.push(String.fromCharCode(((value >>> 10) & 0x3ff) | 0xd800));
                value = 0xdc00 | (value & 0x3ff);
            }
            output.push(String.fromCharCode(value));
        }
        return output.join("");
    },
};

export function decode(input: string, preserveCase?: boolean): string {
    // 不要使用utf16
    let output: number[] = [];
    let case_flags: boolean[] = [];
    let input_length = input.length;

    let n, out, i, bias, basic, j, ic, oldi, w, k, digit, t, len;

    // 初始化状态：

    n = initial_n;
    i = 0;
    bias = initial_bias;

    // 处理基本代码点：让basic成为输入代码的数量
    // 在最后一个分隔符之前点，如果没有，则为0
    // 将第一个基本代码点复制到输出。

    basic = input.lastIndexOf(delimiter);
    if (basic < 0) basic = 0;

    for (j = 0; j < basic; ++j) {
        if (preserveCase) case_flags[output.length] = input.charCodeAt(j) - 65 < 26;
        if (input.charCodeAt(j) >= 0x80) {
            throw new RangeError("Illegal input >= 0x80");
        }
        output.push(input.charCodeAt(j));
    }

    // 主解码循环：在最后一个定界符（如果有）之后开始
    // 基本代码点被复制；否则就从头开始。

    for (ic = basic > 0 ? basic + 1 : 0; ic < input_length; ) {
        // ic是下一个要使用的字符的索引，

        // 将一个广义变长整数解码为增量，增量被加到i中。溢出检查更容易
        // 如果我们在前进中增加i，那么减去它的起始值
        // 值以获得增量。
        for (oldi = i, w = 1, k = base; ; k += base) {
            if (ic >= input_length) {
                throw RangeError("punycode_bad_input(1)");
            }
            digit = decode_digit(input.charCodeAt(ic++));

            if (digit >= base) {
                throw RangeError("punycode_bad_input(2)");
            }
            if (digit > Math.floor((maxInt - i) / w)) {
                throw RangeError("punycode_overflow(1)");
            }
            i += digit * w;
            t = k <= bias ? tmin : k >= bias + tmax ? tmax : k - bias;
            if (digit < t) {
                break;
            }
            if (w > Math.floor(maxInt / (base - t))) {
                throw RangeError("punycode_overflow(2)");
            }
            w *= base - t;
        }

        out = output.length + 1;
        bias = adapt(i - oldi, out, <number>(<unknown>(oldi === 0)));

        // i was supposed to wrap around from out to 0,
        // incrementing n each time, so we'll fix that now:
        if (Math.floor(i / out) > maxInt - n) {
            throw RangeError("punycode_overflow(3)");
        }
        n += Math.floor(i / out);
        i %= out;

        // Insert n at position i of the output:
        // Case of last character determines uppercase flag:
        if (preserveCase) {
            case_flags.splice(i, 0, input.charCodeAt(ic - 1) - 65 < 26);
        }

        output.splice(i, 0, n);
        i++;
    }
    if (preserveCase) {
        for (i = 0, len = output.length; i < len; i++) {
            if (case_flags[i]) {
                output[i] = String.fromCharCode(output[i]).toUpperCase().charCodeAt(0);
            }
        }
    }
    return utf16.encode(output);
}
export function encode(str: string, preserveCase?: boolean): string {
    //** Bias adaptation function **

    let n, delta, h, b, bias, j, m: number, q, k, t, ijv, case_flags;

    // Converts the input in UTF-16 to Unicode
    let input = utf16.decode(str.toLowerCase());
    let input_length = input.length; // Cache the length

    if (preserveCase) {
        // 保留大小写

        case_flags = utf16.decode(str); //第1步（共2步）：获取未更改字符串的列表
        for (j = 0; j < input_length; j++) {
            // 第2步，共2步：将列表修改为true/false
            case_flags[j] = <number>(<unknown>(input[j] != case_flags[j]));
        }
    }

    let output: string[] = [];

    // Initialize the state:
    n = initial_n;
    delta = 0;
    bias = initial_bias;

    // Handle the basic code points:
    for (j = 0; j < input_length; ++j) {
        if (input[j] < 0x80) {
            output.push(String.fromCharCode(case_flags ? encode_basic(input[j], case_flags[j]) : input[j]));
        }
    }

    h = b = output.length;

    // h is the number of code points that have been handled, b is the
    // number of basic code points

    if (b > 0) output.push(delimiter);

    // Main encoding loop:
    //
    while (h < input_length) {
        // All non-basic code points < n have been
        // handled already. Find the next larger one:

        for (m = maxInt, j = 0; j < input_length; ++j) {
            ijv = input[j];
            if (ijv >= n && ijv < m) m = ijv;
        }

        // Increase delta enough to advance the decoder's
        // <n,i> state to <m,0>, but guard against overflow:

        if (m - n > Math.floor((maxInt - delta) / (h + 1))) {
            throw RangeError("punycode_overflow (1)");
        }
        delta += (m - n) * (h + 1);
        n = m;

        for (j = 0; j < input_length; ++j) {
            ijv = input[j];

            if (ijv < n) {
                if (++delta > maxInt) throw Error("punycode_overflow(2)");
            }

            if (ijv == n) {
                // Represent delta as a generalized variable-length integer:
                for (q = delta, k = base; ; k += base) {
                    t = k <= bias ? tmin : k >= bias + tmax ? tmax : k - bias;
                    if (q < t) break;
                    output.push(String.fromCharCode(encode_digit(t + ((q - t) % (base - t)), 0)));
                    q = Math.floor((q - t) / (base - t));
                }
                output.push(String.fromCharCode(encode_digit(q, preserveCase && case_flags && case_flags[j] ? 1 : 0)));
                bias = adapt(delta, h + 1, <number>(<unknown>(h == b)));
                delta = 0;
                ++h;
            }
        }

        ++delta, ++n;
    }
    return output.join("");
}

