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

module.exports = class WattyThermoHum extends SensorInterface {
    /**
     * 温湿度計算.
     */
    static process(data) {
        const dataLength = 10; // 5Byte * 2
        // 処理に必要なデータ長を抽出
        const fixedLengthData = data.replace('0x', '').slice(0, dataLength);
        const ret = [];
        if (fixedLengthData.length < dataLength) {
            // 5Byte以上でなければ空リスト返却
            return ret;
        }
        // 0~3: 湿度, 4~7: 温度, 8~9: 電圧
        const dec1 = parseInt(fixedLengthData.substr(0, 4), 16);
        const dec2 = parseInt(fixedLengthData.substr(4, 4), 16);
        const dec3 = parseInt(fixedLengthData.substr(8, 2), 16);

        const paramList = [];
        // 湿度計算を行い、小数第5位を四捨五入して代入
        const humidity = Math.round((parseFloat(dec1) / 65535.0) * 100 * 10000) / 10000;
        paramList.push(humidity);
        // 温度計算を行い、小数第5位を四捨五入して代入
        const temperature = Math.round((parseFloat(dec2 / 65535.0) * 175 - 45) * 10000) / 10000;
        paramList.push(temperature);
        // 電圧計算を行い、小数第4位を四捨五入して代入
        const volt = Math.round(parseFloat((dec3 * 3.6) / 255) * 1000) / 1000;
        paramList.push(volt);
        return paramList;
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function WattyHyhu3Sensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;
            this.configObject = config.configObject;

            this.on('input', function (msg) {});
            this.on('close', function () {});
        }
        RED.nodes.registerType('Watty_HYHU3_Sensor', WattyHyhu3Sensor);
    }
};
