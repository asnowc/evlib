## 3.x

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
