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

module.exports = class ErmineTemperatureHumidity extends SensorInterface {
    /**
     * 温湿度計算.
     */
    static process(data) {
        const dataLength = 8; // 4Byte * 2
        // dataを正常に処理できるようにする
        if (data === '0') {
            data = '0'.repeat(dataLength);
        }
        // 処理に必要なデータ長を抽出
        const fixedLengthData = data.replace('0x', '').slice(0, dataLength);
        const result = [];
        if (fixedLengthData.length < dataLength) {
            // 4Byte以上でなければ空リスト返却
            return result;
        }
        // 4Byteのデータ長のうち1~2Byte目が湿度、3~6Byte目(末端10bit分)が温度
        // 湿度の抽出(0~1Byte)
        const dec1 = parseInt(fixedLengthData.substr(0, 2), 16);
        // 温度の抽出(2~6Byte)
        const dec2 = parseInt(fixedLengthData.substr(2, 4), 16);

        // 湿度の計算（0～255の数値を0～100%に変換する)
        let hid = dec1 * (100 / 250);
        // 温度の計算（0～1023の数値を-20～60℃に変換する)
        let temp = dec2 * (80 / 1023) - 20;
        // 誤差を丸める
        hid = Math.round(hid * 10) / 10;
        temp = Math.round(temp * 100) / 100;

        result.push(hid);
        result.push(temp);

        return result;
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function ErmineTempHumSensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;
            this.configObject = config.configObject;

            this.on('input', function (msg) {});
            this.on('close', function () {});
        }
        RED.nodes.registerType('Ermine_Temp_Hum_Sensor', ErmineTempHumSensor);
    }
};
