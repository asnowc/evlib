/** @public */
export const TYPE_CHECK_FN = Symbol("type check object");

/**
 * 自定义类型校验
 * @public
 */
export interface TypeChecker<T = unknown> {
  optional?: boolean;
  /** 前置类型, 前置类型匹配才会执行检测函数, 如果不匹配, 检测直接不通过 */
  baseType?: BasicType;
  [TYPE_CHECK_FN]: TypeCheckFn<T>;
}

/**
 * 如果检测不通过，提供的错误描述
 * @public
 */
export type TypeErrorDesc = string | { [key: string]: TypeErrorDesc };

/**
 * 自定义类型校验函数
 * @public
 */
export interface TypeCheckFn<T = any> {
  (val: any, option: Readonly<TypeCheckOptions>): TypeCheckFnCheckResult<T>;
  /** 前置类型, 前置类型匹配才会执行检测函数, 如果不匹配, 检测直接不通过 */
  baseType?: BasicType;
}
/** @public */
export type CustomChecker<T = unknown> = TypeChecker<T> | TypeCheckFn<T>;

/** @public */
export type BasicType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "undefined"
  | "object"
  | "function"
  | "null";

/**  @public */
export type ExpectUnionType = ExpectType[];

/**
 * 对象属性检测
 * @public
 */
export type ExpectObjectType = {
  [key: string | number]: ExpectType;
  [key: symbol]: any;
};

/** 类型检测
 * @remarks
 * string: BasicType 基础类型检测
 * function: 自定义检测函数
 * true: 检测通过, 可以用于 any类型
 * @public
 */
export type ExpectType<T = unknown> =
  | TypeCheckFn<T>
  | TypeChecker<T>
  | BasicType
  | ExpectObjectType
  | ExpectUnionType;

/** @public */
export interface TypeCheckOptions {
  /** 检测策略
   * @remarks 对于对象和元组类型, 如果对象或元组中存在预期类型中不存在的字段, 应该执行的策略
   *   "pass": 检测通过
   *   "error": 检测不通过
   *   "delete": 检测通过, 并删除多余字段
   * @defaultValue "error"
   */
  policy?: "pass" | "delete" | "error";

  /** 为true检测所有预期类型, 为false时返回第一检测不通过的结果
   * @defaultValue false
   */
  checkAll?: boolean;
  /** 如果设置为true, 对于数组类型和对象类型, 将会进行拷贝
   */
  // new?: boolean;
}
type TypeCheckError = {
  error: TypeErrorDesc;
  value?: undefined;
  replace?: undefined;
};
type TypeCheckReplace<T> = {
  error?: undefined;
  /** 要替换的值 */
  value: T;
  replace: boolean;
};
/** @public */
export type TypeCheckFnCheckResult<T = unknown> =
  | TypeCheckError
  | TypeCheckReplace<T>
  | void;

type InferBaseMap = {
  number: number;
  bigint: bigint;
  boolean: boolean;
  undefined: undefined;
  null: null;
  function: Fn;
  object: object;
  symbol: symbol;
  string: string;
  [key: string]: unknown;
};
/**
 * 推断预期类型
 * @public
 */
export type InferExpect<T> = T extends string ? InferBaseMap[T]
  : T extends any[] ? InferExpectUnion<T>
  : T extends TypeCheckFn<infer E> ? E
  : T extends TypeChecker<infer E> ? E
  : T extends object ? {
      [key in keyof T]: InferExpect<T[key]>;
    }
  : unknown;

/** @public */
export type InferExpectUnion<T extends any[]> = T extends [infer P, ...infer Q] ? InferExpect<P> | InferExpectUnion<Q>
  : never;

type Fn = (...args: any[]) => any;
