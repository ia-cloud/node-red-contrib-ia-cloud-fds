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

module.exports = class WattyHyhqFf extends SensorInterface {
    /**
     * 温度計算.
     */
    static process(data) {
        // 16進数表記から0xを除外
        const dataString = data.replace('0x', '');
        const ret = [];
        if (dataString.length < 17) {
            // 17Byte以上でなければ空リスト返却
            return ret;
        }
        // 0~3: 温度1, 4~7: 温度2, 8~11: 温度3, 12~15: 温度4, 16: 電圧
        const dec1 = parseInt(dataString.substr(0, 4), 16);
        const dec2 = parseInt(dataString.substr(4, 4), 16);
        const dec3 = parseInt(dataString.substr(8, 4), 16);
        const dec4 = parseInt(dataString.substr(12, 4), 16);
        const dec5 = parseInt(`${dataString.substr(16, 1)}0`, 16); // 末尾に0を追加して2byteにする
        const decList = [];
        decList.push(dec1);
        decList.push(dec2);
        decList.push(dec3);
        decList.push(dec4);

        const paramList = [];
        decList.forEach((chVal) => {
            // 温度計算を行い、小数第4位を四捨五入して代入
            const param = Math.round(((parseFloat(chVal) / 65535.0) * 310 - 50) * 1000) / 1000;
            paramList.push(param);
        });
        // 電圧計算を行い、小数第4位を四捨五入して代入
        const volt = Math.round(parseFloat((dec5 * 3.3) / 255) * 1000) / 1000;
        paramList.push(volt);
        return paramList;
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function WattyHyhqFfSensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;
            this.configObject = config.configObject;

            this.on('input', function (msg) {});
            this.on('close', function () {});
        }
        RED.nodes.registerType('Watty_HYHQ_FF_Sensor', WattyHyhqFfSensor);
    }
};
