"use strict";

/**
* @description 创建节点,onload为模仿触发
* @param {object} obj 为节点添加的属性，格式为JSON格,只添加obj中可枚举的属性
* @param {node} faNode 节点名，如果传入节点对象，则只为节点添加属性
* {
*      nodeName:"table",
*      style：{
*          position："absolute",
*          left:"20px"
*      },
*      xxx:xxxx
*      children:[json,json,node]
* }
* @param {object} faNode 可选项，将节点添加为该节点的父节点
* @return {object} 返回创建的节点
*/
function add(json, faNode) {
    /* err.Nty:
        1:参数1不是Object类型(附加参数1)
        2:参数1中的nodeName属性的值不是字符串(附加nodeName的键值)
        3:添加属性出错(附加出错属性的键值对)
        4:参数2不是节点(附加 父节点)  //用户错误
        5:添加到父节点时出错(附加 父节点)  //用户错误
        6:onload函数执行出错(附加onload键值对)
    */
    if (Object.typeof(json, false) === "object") {
        let nodeName = json.nodeName;
        if (typeof nodeName === "string")
            var newNode = document.createElement(nodeName);
        else {
            var err = new Error("参数1中的nodeName属性必须我为string类型").prior().add({ nodeName });
            err.Nty = 2;
            throw err;
        }
    } else {
        var err = new Error().argTypeErr(arguments, 1, "object");
        err.Nty = 1;
        throw err;
    }
    var thisFx = AS.GUI.add;
    var url = thisFx.url;
    var att = Object.create(json);
    att.nodeName = undefined;
    att.onload = undefined;

    if (Array.isArray(url)) {
        url[0]++;
        url.push(newNode);
    } else {
        if (faNode instanceof HTMLElement) url = [2, faNode, newNode];
        else url = [1, newNode];
    }

    try {
        AS.GUI.set.url = url;
        AS.GUI.set(att, newNode);
    } catch (error) {//添加属性错误
        error.Nty = 3;
        throw error.prior();
    }
    if (faNode instanceof HTMLElement) {
        try {//被添加错误
            faNode.appendChild(newNode);
        } catch (error) {
            var err = new Error("无法添加到父节点:(" + error.message + ")").prior().add(faNode);
            err.Nty = 5;
            throw err;
        }
    } else if (faNode !== undefined) {
        var err = new Error("参数2必须为节点，否则无法添加到父节点").add(faNode).prior();
        err.Nty = 4;
        throw err;
    }

    if (typeof json.onload === "function") {//load事件
        try {
            json.onload.call(newNode);
        } catch (error) {
            error.prior().message = "参数1的onload函数被执行时出现异常：(" + error.message + ")";
            error.add({ onload: json.onload });
            error.Nty = 6;
            throw error;
        }
    }
    url[0]--;
    url.pop();
    return newNode;
}

/**
* @description //按照JSNO格式给nodeObj节点添加属性(只添加json中可枚举的属性)
* @param {object} json 
* @param {HTMLElement|string} 
* @return {} 
*/
function set(json, node) {
    /* err.Nty:
        1:children属性不为Array类型导致出错(附加children键值对)
        2:添加子节点错误(附加children键值对)
        3:添加属性出错(附加出错属性的键值对)
        4:style属性不是object类型(附加style键值对)
    */
    var typeo = Object.typeof;
    if (typeo(json, false) !== "object") {
        throw new Error().argTypeErr(arguments, 1, "object");
    }
    if (typeof node === "string") node = document.createElement(node);
    else if (!(node instanceof HTMLElement))
        throw new Error("参数2的原型链上必须要有HTMLElement").prior().add(node);

    var url = AS.GUI.add;
    for (var attName in json) {
        let value = json[attName];
        let type = typeo(value);
        if (value === undefined)
            continue;


        if (attName === "style") {//样式属性
            if (type !== "Object") {
                var err = Error("参数1中的style属性必须为object类型").prior().add({ style: value });
                err.Nty = 4;
                throw err;
            }
            let keys = Object.keys(value);
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                node.style[key] = value[key];
            }
        } else if (attName === "children") {
            if (type !== "Array") {
                var err = new Error("参数1中的children属性必须为Array类型").prior().add({ children: value });
                err.Nty = 1;
                throw err;
            }
            for (var x = 0; x < value.length; x++) {
                let val = value[x];
                if (val instanceof HTMLElement) {//判断出对象为一个节点
                    node.appendChild(val);
                } else if (typeof val === "string") {
                    node.appendChild(document.createTextNode(val));
                } else {
                    try {
                        AS.GUI.add.url = url;
                        AS.GUI.add(val, node, url);//添加子节点
                    } catch (error) {//理论上不会出现4、5类错误
                        if (error.Nty === 1) {
                            var adObj = { children: error.addInfo };
                        } else if (error.Nty <= 3 || error.Nty === 6) {
                            var adObj = { children: { [x]: error.addInfo } };
                        } else {
                            var adObj = "函数内部错误"
                        }
                        error.add(adObj);
                        error.Nty = 2;
                        throw error.prior().add({ children: [x] });
                    }
                }
            }
        } else if (attName === "childNode") {//被上级节点指向(作为子对象)
            //给指定父节点添加指向子节点的属性
            let nattName, nattX, X;
            if (type === "string" && Array.isArray(url)) {
                nattName = value, nattX = 1;
            } else if (Array.isArray(value)) {
                nattName = value[0], nattX = value[1];
            } else {
                continue;
            }
            X = url[0] - nattX;
            if (X > 0) {
                url[X][nattName] = node;
            }
        } else if (attName === "parentNode") {//指向上级节点(作为父对象)
            //给指定父节点添加指向子节点的属性
            let nattName, nattX;
            if (type === "string" && Array.isArray(url)) {
                nattName = value, nattX = 1;
            } else if (Array.isArray(value)) {
                nattName = value[0], nattX = value[1];
            } else {
                continue;
            }
            if (url[0] - nattX > 0) {
                node[nattName] = url[nattX];
            }
        } else {
            try {
                node[attName] = value;   //添加属性
            } catch (error) {
                var err = new Error("属性 \"" + attName + "\" 添加失败：(" + error.message + ")");
                err.prior().add({ attName: value }).Nty = 3;
                throw err;
            }
        }
    }
    return node;
}
function addChilds(node, childs) {//给node节点添加子节点
    if (!Array.isArray(childs))
        throw err = new Error("参数错误！").argTypeErr(arguments, 1, "Array");
    if (!(node instanceof HTMLElement)) {
        throw err = new Error("参数2的原型链上必须要有HTMLElement").prior();
    }
    try {
        for (var i = 0; i < childs.length; i++) {
            if (childs[i] instanceof HTMLElement)
                node.appendChild(childs[i]);
            else
                GUI.add(childs[i], node);
        }
    } catch (error) {
        if (error.Nty === 1) {
            var adObj = { children: error.addInfo };
        } else if (error.Nty <= 3 || error.Nty === 6) {
            var adObj = { children: { [x]: error.addInfo } };
        } else if (error.Nty === undefined) {
            var adObj = { [i]: childs[i] };
        } else {
            var adObj = "函数内部错误"
        }
        throw error.add(adObj).prior();
    }
}

module.exports = {

};