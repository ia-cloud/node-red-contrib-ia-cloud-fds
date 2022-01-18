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

module.exports = class WattyHyhq extends SensorInterface {
    /**
     * 温度計算.
     */
    static process(data) {
        const dataLength = 8; // 4Byte * 2
        // 処理に必要なデータ長を抽出
        const fixedLengthData = data.replace('0x', '').slice(0, dataLength);
        const ret = [];
        if (fixedLengthData.length < dataLength) {
            // 4Byte以上でなければ空リスト返却
            return ret;
        }
        // 0~3: 温度1, 4~7: 温度2
        const dec1 = parseInt(fixedLengthData.substr(0, 4), 16);
        const dec2 = parseInt(fixedLengthData.substr(4, 4), 16);
        const decList = [];
        decList.push(dec1);
        decList.push(dec2);

        const paramList = [];
        decList.forEach((chVal) => {
            // 温度計算を行い、小数第4位を四捨五入して代入
            const param = Math.round(((parseFloat(chVal) / 65535.0) * 310 - 50) * 1000) / 1000;
            paramList.push(param);
        });
        return paramList;
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function WattyHyhqSensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;
            this.configObject = config.configObject;

            this.on('input', function (msg) {});
            this.on('close', function () {});
        }
        RED.nodes.registerType('Watty_HYHQ_Sensor', WattyHyhqSensor);
    }
};
