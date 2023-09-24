const msg = {
    en: {
        createErrDesc(except: string, actual: string) {
            return `Except: ${except}, actual: ${actual}`;
        },
    },
    zh: {
        createErrDesc(except: string, actual: string) {
            return `预期: ${except}, 实际: ${actual}`;
        },
    },
};
let desc = msg.zh;

/** @public */
export class TypeError extends Error {
    static createErrDesc = desc.createErrDesc;
    constructor(public cause: TypeErrorDesc, msg?: string) {
        if (!msg) msg = "类型不匹配";
        super(msg, { cause });
    }
}

type TypeErrorDesc = string | { [key: string]: TypeErrorDesc };
/**
 * @public
 * @example 参数 2(msg) 错误: xxxx
 */
export class ParametersError extends Error {
    private static readonly msg = "错误";
    constructor(index: number, desc: string, name?: string) {
        const msg = name ? `${index}(${name})` : index.toString();
        super(`参数 ${msg} 错误: ${desc}`);
    }
}

/** @public */
export class ParametersTypeError extends ParametersError {
    constructor(index: number, cause: string, name?: string);
    constructor(index: number, except: string, actual: string, name?: string) {
        super(index, TypeError.createErrDesc(except, actual), name);
    }
}
