/**
 **     export *=
 *todo  {
 *todo      cheker:{},          //? 内置检查器
 *todo      ops:{},             //? 选项设置
 *todo      type(...argType),   //? 装饰器工厂: 判断argType与传入参数的类型是否一致, 如果一致,正常执行, 否则抛出"调用者错误"
 *todo      typeAll(argType),   //? 同type(), 只是只接受一个参数, 该参数作为所有参数类型的判断
 *todo      type_debug(),       //? 同type(), 只是当env.debug=false 时, 装饰器不起任何左右
 *todo      typeAll_debug(),    //? 参考上面三个函数
 *todo  }
 **argType: ctrl+F 搜索"type argType" 查看匹配规则
 *
 *todo 使用例子:
 ** @argTest.type("string",RegExp,["number",Error],{testFx:argTest.unionType, types:["symbol",Promise]})    //?组合使用
 ** @argTest.typeAll("string", 3)       //? 检查前3个参数的基本类型
 ** @argTest.typeAll("string")          //? 检查所有传入参数的基本类型,
 ** @argTest.type(RegExp)               //? 检查实例类型
 ** @argTest.type(["number",Error])     //? 检查数组内部类型
 ** @argTest.type({testFx:argTest.unionType, types:["symbol",Promise]}) //? 使用自定义检查器  var a={testFx:xx}, testFx的this指向a
 ** @argTest.type(argTest.unionType("symbol",Promise))                  //? 或者使用实现接口的封装
 */

import { err } from "../tool/err.js";
type propDescription = Parameters<typeof Object.defineProperty>[2];
/** 参数检查装饰器类型 */
type argTestDecorator = (
  tagClass: any,
  fxName: string,
  descrp: propDescription,
) => any;

export const ops = {
  /** 是否开启debug模式 */
  debug: false,
  /** error对象的messag属性, 每次抛出异常会调用这个函数生成message字符串 */
  createErrMsg(
    args: IArguments,
    index: number,
    ops: ReturnType<checker["testFx"]>,
  ) {
    var cType = ops?.coType ?? typeof type;
    var nType = ops?.nowType ?? typeof arguments[index];
    var msg =
      "参数" + (index + 1) + "[" + cType + "]错误: 当前传入类型[" + nType + "]";
    return msg;
  },
};
/** 自定义检测器选项 */
interface checker {
  /**
   * @description 检查参数是否合格
   * @param {Arguments} args 参数的arguments
   * @param {number} index 参数arguments的索引
   * @param {argType} type 指定的类型
   * @return {string|void} 如果合格,返回string,否则返回undefined
   */
  testFx: (
    args: IArguments,
    index: number,
  ) => void | {
    coType: string;
    nowType?: string;
    binding?: any;
    childMsg?: string;
  };
  //! ↑↑↑ 类型checker的返回值中, coType必须存在,否则影响联合类型的判断;
  [key: string]: any;
}
/** 检查类型
 * string: typeof 判断
 * Function: instanceof 判断
 * object: 自定义checker
 * argType[]: 数组内判断
 */
type argType = string | Function | argType[] | checker;

/** 装饰器工厂: 检测指定参数 => @argTest([...]) */
export function type(type: argType, ...more: argType[]): argTestDecorator {
  if (arguments.length === 0) throw err("参数不能为空").shield();
  let types = arguments;

  //参数为不同类型,返回装饰器
  return function (tagClass: any, fxName: string, descrp: propDescription) {
    let fx = <Function>descrp.value;
    let len = types.length;
    descrp.value = function 参数检查器(this: any) {
      for (let i = 0; i < len; i++) {
        let type = types[i];
        const re = testTarget(type, arguments, i);
        if (typeof re === "object") {
          let e = err(ops.createErrMsg(arguments, i, re)).shield();
          e.binding = re.binding;
          throw e;
        }
      }
      try {
        Reflect.apply(fx, this, arguments);
      } catch (error) {
        throw err(error).shield();
      }
    };
  };
}
/** 装饰器工厂: 所有参数为同一类型 => @allTest(type,3)
 * @param {argType} type 类型
 * @param {number} len 检测固定长度, 默认为不固定
 */
export function typeAll(type: argType, len?: number): argTestDecorator {
  return function (
    this: { type: argType; len: number },
    tagClass: any,
    fxName: string,
    descrp: propDescription,
  ) {
    let fx = <Function>descrp.value;
    descrp.value = function 参数检查器(this: any) {
      let len2 = len ?? arguments.length;
      for (let i = 0; i < len2; i++) {
        const re = testTarget(type, arguments, i);
        if (typeof re === "object") {
          let e = err(ops.createErrMsg(arguments, i, re)).shield();
          e.binding = re.binding;
          throw e;
        }
      }
      try {
        Reflect.apply(fx, this, arguments);
      } catch (error) {
        throw err(error).shield();
      }
    };
  };
}
/** 装饰器工厂(生产环境无效): 检测指定参数 => @argTest([...]) */
export function type_debug(
  Type: argType,
  ...more: argType[]
): argTestDecorator {
  if (ops.debug) {
    try {
      return (<any>type)(...arguments);
    } catch (error) {
      throw err(error).shield();
    }
  } else return <any>function () {};
}
/** 装饰器工厂(生产环境无效): 同allTypeDe */
export function typeAll_debug(type: argType, len: number): argTestDecorator {
  if (ops.debug) {
    try {
      return (<any>typeAll)(...arguments);
    } catch (error) {
      throw err(error).shield();
    }
  } else return <any>function () {};
}
/** 用来确定检查器 */
function testTarget(
  argType: argType,
  args: IArguments,
  index: number,
): ReturnType<checker["testFx"]> {
  let tp = typeof argType,
    checker: checker;
  if (tp === "string") {
    checker = innerChecker.typeof;
    checker.type = tp;
  } else if (Array.isArray(argType)) {
    checker = innerChecker.typeof;
    checker.type = argType;
  } else if (tp === "object") checker = <checker>argType;
  else if (tp === "function") {
    checker = innerChecker.typeof;
    checker.type = argType;
  } else checker = innerChecker.ignore;
  return checker.testFx(args, index);
}
/** 内部检查器 */
const innerChecker: { [key: string]: checker } = {
  ignore: { testFx() {} },
  typeof: {
    testFx(this: checker, args: IArguments, index: number) {
      let type = <string>this.type;
      this.type = undefined;
      let arg = args[index];
      let nowType = typeof arg;
      if (nowType !== type)
        return { coType: <string>type, nowType, binding: arg };
    },
  },
  instanceof: {
    testFx(args: IArguments, index: number) {
      let type = <Function>this.type;
      this.type = undefined;
      let arg = args[index];
      if (!(arg instanceof type)) {
        let nowTypeof = typeof arg,
          nowType: string = nowTypeof;
        if (arg === null) nowType = "null";
        else if (nowTypeof === "object")
          nowType =
            "object " + Reflect.getPrototypeOf(arg)?.constructor.name ??
            nowTypeof;
        return { coType: "object " + type.name, nowType, binding: arg };
      }
    },
  },
  array: {
    testFx(args: IArguments, index: number) {
      let types = <argType>this.type;
      this.type = undefined;
      let arg = args[index];
      if (!Array.isArray(arg))
        return { coType: "object Array", nowType: typeof arg };

      if (Array.isArray(types)) {
        for (let i = 0; i < types.length; i++) {
          let type = types[i];
          let res = testTarget(type, args, index);
          if (res) return { coType: res.coType, nowType: res.nowType };
        }
      }
    },
  },
};

const checkers_in = {
  unionType(this: { types: argType[] }, args: IArguments, index: number) {
    let types = this.types;
    if (!Array.isArray(types)) return;
    let arg = args[index];
    let que = [];
    for (const type of types) {
      let res = testTarget(type, args, index);
      if (res) que.push(res);
      else return; //不用再判断,直接跳出
    }
    let cTypes = [],
      nowTypes = <Set<string>>new Set(),
      nowTpo = false;

    for (const it of que) {
      let { coType: correctType, nowType } = it;
      if (correctType) cTypes.push(correctType);
      else if (!nowType) nowTpo = true;
      else nowTypes.add(nowType);
    }
    if (nowTpo) cTypes.unshift(typeof arg);

    var nowType: string | undefined;
    if (nowTypes.size === 0) nowType = undefined;
    else if (nowTypes.size === 1) for (const it of nowTypes) nowType = it;
    else nowType = "<" + Array.from(nowTypes).join(">&<") + ">";

    return {
      coType: "<" + cTypes.join(">|<") + ">",
      nowType,
    };
  },
};
/** 内置检查器 */
export const checkers = {
  /** 联合类型(带有length,的object) */
  unionType(type: argType, ...types: argType[]): checker {
    return { types: [...arguments], testFx: checkers_in.unionType };
  },
  /** 非null对象 */

  notNullObj: <checker>{
    testFx(args: IArguments, index: number) {
      let arg = args[index];
      if (typeof arg !== "object" || arg === null)
        return { coType: "class: Array", nowType: typeof arg };
    },
  },
  /** 可枚举类型 */
  enumable: <checker>{ testFx(args: IArguments, index: number) {} },
  /** 数字范围 */
  scopeNumber: <checker>{ testFx(args: IArguments, index: number) {} },

  /** object键值类型检测 */
  objVlaType: <checker>{ testFx() {} },

  ...innerChecker,
};
