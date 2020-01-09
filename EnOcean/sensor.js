// 各センサー毎の測定値計算モジュールをここに定義する

// 登録されているセンサーの計算モジュールリスト
module.exports.module_list = {
    'u-rd': 'calc_ac',
    'watty': 'calc_temperature',
    'core_staff': 'calc_temp_humidity',
    'itec': 'calc_itec_ct',
    'optex_rocker': 'get_rocker_sw',
    'optex_occupancy': 'get_occupancy',
};

// 温度計算（Watty）
module.exports.calc_temperature = function (data) {
    var ret = [];
    if (data.length < 5 * 2) {
        // 5Byte以上でなければ空リスト返却
        return ret;
    }
    // javascriptでは32bit以上の数値をビットシフトできないため
    // 数値を10bit毎に分割してから計算する
    var dec = parseInt(data, 16);
    var bin = dec.toString(2);
    var dec1 = parseInt(bin.substr(0, 10), 2);
    var dec2 = parseInt(bin.substr(10, 10), 2);

    var dec3 = parseInt(bin.substr(20, 10), 2);
    var dec4 = parseInt(bin.substr(30, 10), 2);
    var decList = [];
    decList.push(dec1);
    decList.push(dec2);
    decList.push(dec3);
    decList.push(dec4);

    var tempList = [];
    for (var ch_val of decList) {
        var temp = 130.0 - (parseFloat(ch_val) / 1024.0 * 170.0);
        tempList.push(temp);
    }
    return tempList;
};

// 電流計算（UR-D）
module.exports.calc_ac = function (data) {
    var ret = [];
    if (data.length < 4 * 2) {
        // 4Byte以上でなければ空リスト返却
        return ret;
    }
    var dec = parseInt(data, 16);
    var acList = [];
    var ad_val = (dec >> 8) & 0b1111111111;

    var K = 0;
    if (ad_val < 9) {
        K = (-0.0448 * ad_val) + 1.77;
    } else if (ad_val >= 9 && ad_val < 20) {
        K = (-0.0114 * ad_val) + 1.46;
    } else if (ad_val >= 20 && ad_val < 227) {
        K = (-0.000433 * ad_val) + 1.25;
    } else if (ad_val >= 227 && ad_val < 822) {
        K = (0.0000218 * ad_val) + 1.15;
    } else {
        K = (0.000365 * ad_val) + 0.86;
    }

    var E = 1.76;
    // CT径が10mm なのでc, d は以下の数値
    var c = 56;
    var d = 3000;

    var I = (ad_val * K * E * d) / (2.8 * c);
    var ac = I / 1000;
    acList.push(ac);

    return acList;
};

// 温湿度計算（Core Staff）
module.exports.calc_temp_humidity = function (data) {
    var result = [];
    if (data.length < 4 * 2) {
        // 4Byte以上でなければ空リスト返却
        return result;
    }
    // 4Byteのデータ長のうち先頭2Byte目が湿度、3Byte目が温度
    var dec = parseInt(data, 16);
    // 湿度の抽出(2Byte目)
    var dec1 = (dec >> 16) & 0xFF;
    // 温度の抽出(3Byte目)
    var dec2 = (dec >> 8) & 0xFF;

    // 湿度、温度の計算（0～250の数値を0～100%、-20～60℃に変換する)
    var hid = dec1 * (100 / 250);
    var temp = dec2 * (80 / 250) - 20;
    // 誤差を丸める
    hid = Math.round(hid * 10);
    hid = hid / 10;
    temp = Math.round(temp * 100);
    temp = temp / 100;

    result.push(hid);
    result.push(temp);

    return result;
};

// 電流計算（ITEC）
module.exports.calc_itec_ct = function (data) {
    var result = [];
    if (data.length < 3 * 2) {
        // 3Byte以上でなければ空リスト返却
        return result;
    }
    var dec = parseInt(data, 16);
    var bin = dec.toString(2);
    var bin = ('000000000000000000000000' + bin).slice(-24); // 0パディング（24桁）
    // Divisor（先頭から2bit目)の値を取得する
    var div = parseInt(bin.substr(1, 1), 2);

    // 1CH分の値とDivisor（及びPower Fail）を取得
    var div_ch = dec >> 4;

    // CH1の値
    var ch1 = div_ch & 0xFFF;

    if (div == 1) {
        // Scaleが10分の1
        result.push(ch1 / 10);
    } else {
        // Scaleがそのまま
        result.push(ch1);
    }

    return result;
};

// ロッカースイッチの状況取得（OPTEX）
module.exports.get_rocker_sw = function (data) {
    var result = [];
    if (data.length < 2) {
        // 1Byte以上でなければ空リスト返却
        return result;
    }
    var dec = parseInt(data, 16);
    var bin = dec.toString(2);
    var bin = ('00000000' + bin).slice(-8); // 0パディング（8桁）
    // State of the energy bow
    var ebo = parseInt(bin.substr(0, 1), 2);
    // State I of rocker B
    var rbi = parseInt(bin.substr(4, 1), 2);
    // State O of rocker B
    var rbo = parseInt(bin.substr(5, 1), 2);
    // State I of rocker A
    var rai = parseInt(bin.substr(6, 1), 2);
    // State O of rocker A
    var rao = parseInt(bin.substr(7, 1), 2);

    if (ebo == 1) {
        result.push('pressed');
    } else {
        result.push('released');
    }
    if (rbi == 1) {
        result.push('pressed');
    } else {
        result.push('released');
    }
    if (rbo == 1) {
        result.push('pressed');
    } else {
        result.push('released');
    }
    if (rai == 1) {
        result.push('pressed');
    } else {
        result.push('released');
    }
    if (rao == 1) {
        result.push('pressed');
    } else {
        result.push('released');
    }

    return result;
};

// 在室センサーの状況取得（OPTEX）
module.exports.get_occupancy = function (data) {
    var result = [];
    if (data.length < 4 * 2) {
        // 4Byte以上でなければ空リスト返却
        return result;
    }

    // 4Byteのデータ長のうち先頭1Byte目が供給電圧、3Byte目が在室状態
    var dec = parseInt(data, 16);
    // 供給電圧の抽出(1Byte目)
    var dec1 = (dec >> 24) & 0xFF;
    // 在室状態の抽出(3Byte目)
    var dec2 = (dec >> 8) & 0xFF;
    // 供給電圧利用可否フラグ
    var is_supply = dec & 0x01;

    // 供給電圧の計算（0～250の数値を0～5.0Vに変換する)
    var volt = dec1 * (5 / 250);
    // 誤差を丸める
    volt = Math.round(volt * 100);
    volt = volt / 100;

    // 在室状態
    var occupancy = '';
    if (dec2 < 128) {
        occupancy = '不在です'; // 不在
    } else {
        occupancy = '在室しています'; // 在室
    }

    // 供給電圧利用不可の場合は供給電圧を無効とする
    if (is_supply == 0) {
        volt = '利用不可';
    }
    result.push(volt);
    result.push(occupancy);

    return result;
};
