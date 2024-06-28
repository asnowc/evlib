const asErr = class 空的异常处理类 extends Error {
  constructor(msg?: string) {
    super(msg);
  }
  binding?: any;
  up?: number;
  setBinding(val: any): this {
    //添加捆绑数据
    this.binding = val;
    return this;
  }
  shield(up: number = 1) {
    if (this.up) this.up += up;
    else this.up = up;
    return this;
  }
};
function errFx(get?: any): InstanceType<typeof asErr> {
  if (get instanceof asErr) return <InstanceType<typeof asErr>>get;
  else if (get instanceof Error) return new asErr(get.message);
  else return new asErr(get);
}
var nFx = function 异常生成(bind: any, ...x: any): InstanceType<typeof asErr> {
  var err = new asErr("参数错误");
  err.binding = bind;
  return err;
};
errFx.argType = nFx;
errFx.arg = nFx;
errFx.msg_type = function getType(...x: any) {
  return "";
};
errFx.inArg = nFx;
errFx.inArgType = nFx;
export var err = errFx;
export default errFx;
