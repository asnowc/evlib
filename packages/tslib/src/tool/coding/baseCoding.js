export const b = {
    mco: "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz `-=[]\\;',./~_+{}|:\"<>?",
    arrTo: {
        UTF8: function (arrData) {
            function getNext(x, mx) {
                for (let m = i + x; i < m; ) {
                    i++;
                    let bit = arrData[i] % 0x40;
                    mx = mx * 0x40 + bit;
                }
                return mx;
            }
            var UTF_8 = "";
            for (var i = 0; i < arrData.length; i++) {
                var bit = arrData[i]; //debugger
                if (bit < 0x80) UTF_8 += String.fromCharCode(bit); //1byte
                else if (bit < 0xe0) {
                    //2byte
                    let num = getNext(1, bit);
                    UTF_8 += String.fromCharCode(num);
                } else if (bit < 0xf8) {
                    //3byte
                    let num = getNext(2, bit);
                    UTF_8 += String.fromCodePoint(num);
                } else UTF_8 += String.fromCodePoint(bit); //4byte以上
            }
            return UTF_8;
        },
        UTF16BE: function (arr) {
            //数据转UTF-16BE
            var str = "";
            for (let i = 0; i < arr.length; i += 2) {
                var num = arr[i];
                num += arr[i + 1] * 0x100;
                str += String.fromCharCode(num);
            }
            return str;
        },
        UTF16LE: function (arr) {
            var str = "";
            for (let i = 0; i < arr.length; i += 2) {
                var num = arr[i + 1];
                num += arr[i] * 0x100;
                str += String.fromCharCode(num);
            }
            return str;
        },
        bit2: function (arr) {
            var str = "";
            for (let i = 0; i < arr.length; i++) {
                var bit = arr[i].toString(2);
                switch (bit.length) {
                    case 1:
                        bit = "0000000" + bit;
                        break;
                    case 2:
                        bit = "000000" + bit;
                        break;
                    case 3:
                        bit = "00000" + bit;
                        break;
                    case 4:
                        bit = "0000" + bit;
                        break;
                    case 5:
                        bit = "000" + bit;
                        break;
                    case 6:
                        bit = "00" + bit;
                        break;
                    case 7:
                        bit = "0" + bit;
                        break;
                }
                str += bit;
            }
            return str;
        },
        bit16: function (arr) {
            var str = "";
            for (let i = 0; i < arr.length; i++) {
                var byte = arr[i].toString(16).toUpperCase();
                if (arr[i] < 0x10) {
                    byte = "0" + byte;
                }
                str += byte;
            }
            return str;
        },
        forma_16: function (arr) {
            //格式化的16进制
            var str = "";
            for (let i = 0; i < arr.length; i++) {
                var byte = arr[i].toString(16).toUpperCase();
                if (arr[i] < 0x10) {
                    byte = "0" + byte;
                }
                str += byte;
                if ((i + 1) % 16 === 0) {
                    str += "\n";
                } else {
                    str += " ";
                }
            }
            return str;
        },
    },
    toArr: {
        UTF16BE: function (U16be) {
            //UTF-16BE转数据
            var arr = [];
            for (var i = 0; i < U16be.length; i++) {
                var charTow = U16be.charCodeAt(i);
                if (charTow > 0xff) {
                    var a = Math.floor(charTow / 0x100); //截取前面部分
                    var b = charTow % 0x100; //截取后面部分
                    arr.push(b);
                    arr.push(a);
                } else {
                    arr.push(charTow);
                    arr.push(0);
                }
            }
            return arr;
        },
    },
};
