/* 功能要求
    事件监听
    取消监听
    事件发布
    事件查看
        查看指定事件名的所有信息
        查看指定事件名，指定ID的信息


    同函数监听
    一次性监听（指定次数监听）
    获取监听时的定义参数（）
    this指定
        使用默认this
        使用订阅者自定义this
        发布者指定函数的this

    重复订阅问题
        使用ID
    
    扩展功能
        事件触发限流器

        改参数函数

*/

interface eventsOnOps {
    /** 回调函数 */
    fx: Function;
    /** 取消事件的ID */
    ID?: any;
    /** 回调函数的this，存在时将覆盖事件发布者的this */
    this?: object;
    /** 回调函数的参数，存在时将覆盖事件发布者的参数 */
    args?: [];
    /** 触发次数 */
    emitCount?: number;
}

type listenerList = Map<any | ((...x: any) => any), eventsOnOps>;
type evetsPool = {
    /** 事件名：map{ID:{}} */
    [propName: string]: listenerList; //事件池中某个事件的类型
};

/**
 * @description
 * @event on,off,emitStart,emitEnd
 */
class 发布订阅模式 {
    #informer(pool: listenerList, args: any[], publisher: object, evName: string) {
        if (!(pool instanceof Map)) return;
        for (const i of pool) {
            let ops = i[1];
            let { fx, args: sArgs, this: This } = ops;

            if (ops.emitCount) {
                //触发次数结束，取消订阅
                if (--ops.emitCount === 0) this.off(evName, i[0]);
            }
            if (typeof This !== "object") This = publisher;
            if (sArgs instanceof Array) args = sArgs;
            try {
                Reflect.apply(fx, This, args);
            } catch (error) {}
        }
    }
    #pool: evetsPool = {
        /*  evName1: map:{
             ID1: {fx:fx,args:[],this:object},
             ID2: [fx,arg],
             ...
            } 
         */
    };
    /**
     * @description 订阅事件
     * @param {string} evName 事件名
     * @param {function} fx 回调函数
     * @param {any} ops
     *   {
     *       ID:any, //存在时，需要用次ID取消监听事件
     *       this:object,    //回调函数的this，存在时将覆盖事件发布者的this
     *       args:[] ,       //回调函数的参数，存在时将覆盖事件发布者的参数
     *       emitCount:-1.   //触发次数，-1为不限次数
     *   }
     * @return {void}
     */
    on(evName: string, fx: Function, ops?: eventsOnOps) {
        //订阅事件
        if (typeof evName !== "string") throw "第一个参数必须为string类型";
        if (typeof fx !== "function") throw "第二个参数必须为function类型";

        var pool = this.#pool;
        var ev = pool[evName] ?? (pool[evName] = new Map());
        //此时ev指向pool中的事件名池

        var ID = ops?.ID;
        ID ??= fx;
        ev.set(ID, {
            fx,
            this: ops?.this,
            args: ops?.args,
            emitCount: ops?.emitCount ?? -1,
        });
        this.#innerEmit("on", [evName, fx, ID]);
    }
    off(evName: string, ID: any) {
        //取消订阅事件
        if (typeof evName !== "string") throw "第一个参数必须为string类型";

        var pool = this.#pool;
        var a = pool[evName];
        if (typeof a != "object") return null;
        a.delete(ID);
        this.#innerEmit("off", [evName, ID]);
        return true;
    }
    #innerEmit(evName: string, args: any[] = []) {
        var pool = this.#pool[evName];
        this.#informer(pool, args, this, evName);
    }
    /**
     * @description 发布事件
     * @param {string} evName 事件名
     * @param {any[]} args 事件参数
     * @param {object} publisher 监听者的this，默认指向事件发布器
     * @param {boolean} async 是否异步发布，默认为否
     * @return {void}
     */
    emit(evName: string, args: any[] = [], publisher: object = this, async: boolean = false) {
        //发布事件 publisher(object):函数的this   args(array):函数的参数  async(boolean):是否为异步发布

        if (typeof evName !== "string") throw "第一个参数必须为string类型";
        if (typeof publisher !== "object") throw "第三个参数必须为object类型";
        if (typeof args !== "object") throw "第二个参数必须为object类型";

        this.#innerEmit("emitStart", [evName, args, publisher, async]);
        var pool = this.#pool[evName];
        if (async) setTimeout(this.#informer, 0, pool, args, publisher, evName);
        else this.#informer(pool, args, publisher, evName);
        this.#innerEmit("emitEnd", [evName, args, publisher, async]);
    }
    once(evName: string, fx: Function, ops: Object = {}) {
        var c: any = ops;
        c.emitCount = 1;
        this.on(evName, fx, c);
    }
}
// export default 发布订阅模式;
export var events = 发布订阅模式;
export default 发布订阅模式;
/* 
Thank you for using GitHub! We're happy you're here.
 Please read this Terms of Service agreement carefully before accessing or using GitHub.
 Because it is such an important contract between us and our users, we have tried to make it as clear as possible.
  For your convenience, we have presented these terms in a short non-binding summary followed by the full legal terms.
*/

declare function setTimeout(handler: (...args: any[]) => any, timeout: number, ...args: any[]): number;
