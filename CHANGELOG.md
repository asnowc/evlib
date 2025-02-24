## 2.x

BREAKING CHANGE:

math: 移除 autoUnit

core:
移除 errors 子包

typeChecker 直接移到 validator 包
并移除 instanceof.typeChecker.instanceof, typeChecker.arrayType, typeChecker.maybeNull, typeChecker.maybeNullish

之前

```ts
import { typeChecker, checkType } from "evlib";
const { numberRange } = typeChecker;
```

现在

```ts
import { numberRange, checkType } from "evlib/validator";
```

tpeChecker.optional 签名更改

```ts
type Optional = (expectType: ExpectType, defaultValue?: any) => TypeCheckResult; // 之前
type Optional = (expectType: ExpectType, mode?: undefined | null | "nullish", defaultValue?: any) => TypeCheckResult; //现在
```

data_struct: 移除 UniqueKeyMap.allowKeySet()
