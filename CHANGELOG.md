## 3.x

### 3.1.4

##### async

fix: 修复 ResourcePool 关闭期间连接创建失败导致 Promise 悬挂的问题
fix: 修复关闭连接池时借用连接、排队请求和被移除连接的收尾流程
feat: 新增 ResourcePool.destroy()，支持立即断开并清理所有连接
fix: 修复 usageLimit 与排队连接交接时的连接淘汰逻辑

### 3.0.0

##### math

BREAKING: 移除 autoUnit

##### core

BREAKING: 移除 errors 子包
BREAKING: typeChecker 直接移到 validator 包

##### validator

feat: 新增 validator 包

之前

```ts
import { typeChecker, checkType } from "evlib";
const { numberRange } = typeChecker;
```

现在

```ts
import { numberRange, checkType } from "evlib/validator";
```

BREAKING: 移除之前的 instanceof.typeChecker.instanceof, typeChecker.arrayType, typeChecker.maybeNull, typeChecker.maybeNullish, typeChecker.union
BREAKING: tpeChecker.optional 签名更改

```ts
type Optional = (expectType: ExpectType, defaultValue?: any) => TypeCheckResult; // 之前
type Optional = (expectType: ExpectType, mode?: undefined | null | "nullish", defaultValue?: any) => TypeCheckResult; //现在
```

BREAKING: 数组用于断言联合类型
之前

```ts
checkType(2, typeChecker.union(["number", "string"]));
```

现在

```ts
checkType(2, ["number", "string"]);
```

feat: 新增 tuple() 用于断言元组

##### data_struct

BREAKING: 移除 UniqueKeyMap.allowKeySet()

```

```
