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

module.exports = class itecCT extends SensorInterface {
    /**
     * 電流計算.
     */
    static process(data) {
        const result = [];
        if (data.length < 3 * 2) {
            // 3Byte以上でなければ空リスト返却
            return result;
        }
        const dec = parseInt(data, 16);
        const bin = `000000000000000000000000${dec.toString(2)}`.slice(-24); // 0パディング（24桁）
        // Divisor（先頭から2bit目)の値を取得する
        const div = parseInt(bin.substr(1, 1), 2);

        // 1CH分の値とDivisor（及びPower Fail）を取得
        const div_ch = dec >> 4;

        // CH1の値
        const ch1 = div_ch & 0xFFF;

        if (div == 1) {
            // Scaleが10分の1
            result.push(ch1 / 10);
        } else {
            // Scaleがそのまま
            result.push(ch1);
        }

        return result;
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function ItecCTSensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;
            this.configObject = config.configObject;

            this.on('input', function (msg) {});
            this.on('close', function () {});
        }
        RED.nodes.registerType('Itec_CT_Sensor', ItecCTSensor);
    }
};
