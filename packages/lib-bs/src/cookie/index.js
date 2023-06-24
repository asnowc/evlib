export default {
    CookiesTime: function (Year, Month, Day, Hours, Minute, Seconds) { //根据传入的时间，返回一个UTC时刻（再过该时间后UTC时间为多少），格式“Thu, 18 Dec 2020 12:00:00 GMT”
        var a = new Date();
        var Y = a.getFullYear();
        var Mth = a.getMonth() + 1; //a.getMoth+1是因为该方法返回的是0~11的月份
        var D = a.getDate();
        var H = a.getHours();
        var Min = a.getMinutes();
        var S = a.getSeconds();
        //当前时间为Y年Mth月D日H点Min分S秒
        return this.UTCAndBeijing(Y + Year, Mth + Month, D + Day, H + Hours, Min + Minute, S + Seconds); //返回设置的cookie的过期时间

    },
    UTCAndBeijing: function (Year, Month, Day, Hours, Minute, Seconds) { //将所提供的北京时间转化为UTC时间，返回字符串，格式“Thu, 18 Dec 2020 12:00:00 GMT”
        Hours = Hours - 8;
        if (Hours < 0) {
            Day = Day - 1;
            Hours = Hours + 24;
            if (Day < 1) {
                var b = (Year - 2000) % 4
                Month = Month - 1;
                if (Month == 4 || Month == 6 || Month == 9 || Month == 11) {
                    Day = 30;
                } else if (Month == 2 && b == 0) {
                    Day = 29;
                } else if (Month == 2 && b != 0) {
                    Day = 28;
                } else {
                    Day = 31;
                }
                if (Month < 1) {
                    Year = Year - 1;
                    Month = 12;
                }
            }
        } //计算UTC时间的年月日、时

        Month--;
        var utc = new Date();
        utc.setUTCFullYear(Year);
        utc.setUTCMonth(Month);
        utc.setUTCDate(Day);
        utc.setUTCHours(Hours);
        utc.setUTCMinutes(Minute);
        utc.setUTCSeconds(Seconds);
        var tio = utc.toUTCString(); //UTC时间
        return tio; //返回UTC时间
    },
    set: function (name, value, time, path) { //设置Cookie，没有传入Time时默认过期时间为1天。name：cookie的名字；value：cookie的值；time：cookie的过期时间；path：cookie的保存路径；name和value为空时返回“no”，time为空时将time设置为当前时间。成功设置cookie时返回“ok”，否则返回“no”。
        name = String(name);
        value = String(value);
        time = String(time);
        path = String(path); //将传入的变量转换为字符串类型

        if (name == "undefined" || value == "undefined") { //Cookie的两个必选项为空
            return "no";
        } else if (time == "undefined") { //Cookie的两个必选项不为空，则判断time是否为空
            document.cookie = name + "=" + value + "; expires=";
            return "ok";
        } else { //time不为空
            if (path == "undefined") {
                document.cookie = name + "=" + value + "; expires=" + time + ";"; //path为空
            } else {
                document.cookie = name + "=" + value + "; expires=" + time + "; path=" + path + ";"; //path不为空
            }
            return "ok";
        }

    },
    get: function (abc, name) { //读取cookie的name对应的值，abc为布尔类型，abc为true时返回所有cookie的名与值，为false时返回name对应的值。cookie里不存在name时返回null。
        var str = [];
        var a = document.cookie;
        var b = a.split("; "); //将cookie进行拆分
        for (var i = 0; i < b.length; i++) { //将cookie的名与值拆分
            str[i] = b[i].split("=");
        }
        if (abc) {
            return str; //返回所有cookie
        } else {
            for (var i = 0; i < str.length; i++) { //寻找name
                if (name == str[i][0]) {
                    return str[i][1]; //返回name对应的值
                }
            }
        }
        return null;
    },
    delete: function (abc, name) { //删除cookies，当abc为true时删除全部，为false时删除单个。成功删除则返回“ok”。
        var time = this.CookiesTime(0, 0, 0, -1, 0, 0);
        if (abc) {
            var a = this.get(true);
            for (var i = 0; i < a.length; i++) {
                name = a[i][0];
                document.cookie = name + "= ; expires=" + time + ";";
            }
            return "ok";
        } else if (this.get(false, name) !== null) {
            document.cookie = name + "= ; expires=" + time + ";";
            return "ok";
        } else {
            return "Cookie里没有“" + name + "”";
        }
    }
}