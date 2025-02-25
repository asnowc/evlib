import type { CustomChecker, InferExpect, InferExpectTuple, InferExpectUnion } from "evlib/validator";

declare const union: InferExpectUnion<["number", "string"]>;

declare function expectNumberTuple(input: InferExpectTuple<["number", "string"]>): void;
expectNumberTuple([1, "a"]);
//@ts-expect-error input 为[number,string]
expectNumberTuple([]);
//@ts-expect-error input 为[number,string]
expectNumberTuple([1, "a", 1]);

declare function expectUnion(input: InferExpect<["number", "string"]>): void;
expectUnion(2);
expectUnion("a");
//@ts-expect-error input 为 number|string
expectUnion(true);

declare function expectObject(
  input: InferExpect<{
    abc: "string";
    def: "number";
  }>,
): void;

//@ts-expect-error
expectObject({});

declare const data: {
  abc: string;
  def: number;
};
expectObject(data);
//@ts-expect-error
expectObject({});
