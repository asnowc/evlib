import { Enum } from "evlib";
import { describe, it, expect } from "vitest";

describe("enum", function () {
  enum AllString {
    a = "va",
    b = "vb",
    c = "vc",
  }
  enum Def {
    a,
    b,
    c,
  }
  enum AllNum {
    a = 0,
    b = 1,
    c = 2,
  }
  enum Mix {
    a = 0,
    b = "vb",
    c = 2,
  }
  it("获取enum的key", function () {
    const expectKeys = ["a", "b", "c"];
    expect(Enum.getKeys(AllString)).toEqual(expectKeys);
    expect(Enum.getKeys(Def)).toEqual(expectKeys);
    expect(Enum.getKeys(AllNum)).toEqual(expectKeys);
    expect(Enum.getKeys(Mix)).toEqual(expectKeys);
  });
});
