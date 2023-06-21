/**
 * Copyright 2019 ia-cloud project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const SensorInterface = require('./sensors-interface');

module.exports = class WattyTemperature extends SensorInterface {
    /**
     * 温度計算.
     */
    static process(data) {
        const dataLength = 10; // 5Byte * 2
        const ret = [];
        // dataを正常に処理できるようにする
        if (data === '0') {
            data = '0'.repeat(dataLength);
        }
        // 処理に必要なデータ長を抽出
        const fixedLengthData = data.replace('0x', '').slice(0, dataLength);
        if (fixedLengthData.length < dataLength) {
            // 5Byte以上でなければ空リスト返却
            return ret;
        }
        // javascriptでは32bit以上の数値をビットシフトできないため
        // 数値を10bit毎に分割してから計算する
        const dec = parseInt(fixedLengthData, 16);
        const bin = dec.toString(2);
        const dec1 = parseInt(bin.substr(0, 10), 2);
        const dec2 = parseInt(bin.substr(10, 10), 2);

        const dec3 = parseInt(bin.substr(20, 10), 2);
        const dec4 = parseInt(bin.substr(30, 10), 2);
        const decList = [];
        decList.push(dec1);
        decList.push(dec2);
        decList.push(dec3);
        decList.push(dec4);

        const tempList = [];
        for (const chVal of decList) {
            const temp = 130.0 - (parseFloat(chVal) / 1024.0 * 170.0);
            tempList.push(temp);
        }
        return tempList;
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function WattyTempSensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;
            this.configObject = config.configObject;

            this.on('input', function (msg) {});
            this.on('close', function () {});
        }
        RED.nodes.registerType('Watty_Temp_Sensor', WattyTempSensor);
    }
};
