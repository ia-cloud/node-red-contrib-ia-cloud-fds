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

module.exports = class WattyHyco extends SensorInterface {
    /**
     * CO2濃度計算.
     */
    static process(data) {
        // 16進数表記から0xを除外
        const dataString = data.replace('0x', '');
        const ret = [];
        if (dataString.length < 6 * 2) {
            // 6Byte以上でなければ空リスト返却
            return ret;
        }
        // 0~3: CO2濃度, 4~7: 湿度, 8~11: 温度
        const dec1 = parseInt(dataString.substr(0, 4), 16);
        const dec2 = parseInt(dataString.substr(4, 4), 16);
        const dec3 = parseInt(dataString.substr(8, 4), 16);
        const paramList = [];

        // CO2濃度計算を行い、小数第4位を四捨五入して代入
        const co2 = Math.round((parseFloat(dec1) / 65535.0) * 40000 * 1000) / 1000;
        paramList.push(co2);
        // 湿度計算を行い、小数第5位を四捨五入して代入
        const humidity = Math.round((parseFloat(dec2) / 65535.0) * 100 * 10000) / 10000;
        paramList.push(humidity);
        // 温度計算を行い、小数第5位を四捨五入して代入
        const temperature = Math.round((parseFloat(dec3 / 65535.0) * 175 - 45) * 10000) / 10000;
        paramList.push(temperature);
        return paramList;
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function WattyHycoSensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;
            this.configObject = config.configObject;

            this.on('input', function (msg) {});
            this.on('close', function () {});
        }
        RED.nodes.registerType('Watty_HYCO_Sensor', WattyHycoSensor);
    }
};
