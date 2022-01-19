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

module.exports = class OptexOccupancy extends SensorInterface {
    /**
     * 在室センサーの状況取得.
     */
    static process(data) {
        const dataLength = 8; // 4Byte * 2
        // 処理に必要なデータ長を抽出
        const fixedLengthData = data.replace('0x', '').slice(0, dataLength);
        const result = [];
        if (fixedLengthData.length < dataLength) {
            // 4Byte以上でなければ空リスト返却
            return result;
        }

        // 4Byteのデータ長のうち先頭1Byte目が供給電圧、3Byte目が在室状態
        const dec = parseInt(fixedLengthData, 16);
        // 供給電圧の抽出(1Byte目)
        const dec1 = (dec >> 24) & 0xFF;
        // 在室状態の抽出(3Byte目)
        const dec2 = (dec >> 8) & 0xFF;
        // 供給電圧利用可否フラグ
        const is_supply = dec & 0x01;

        // 供給電圧の計算（0～250の数値を0～5.0Vに変換する)
        let volt = dec1 * (5 / 250);
        // 誤差を丸める
        volt = Math.round(volt * 100);
        volt = volt / 100;

        // 在室状態
        let occupancy = '';
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
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function Optex_Occupancy_Sensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;

            const node = this;
            const confObj = config.configObject;
            this.dItems = {};
            if (confObj) {
                try {
                    this.dItems = JSON.parse(confObj);
                } catch (e) {
                    // nodeのエラーを通知してして終了
                    node.error('runtime:jsonerror', confObj);
                }
            } else {
                // nodeのエラーを通知してして終了
                node.error('runtime:jsonerror', confObj);
            }
            this.on('input', function (msg) {});
            this.on('close', function () {});
        }
        RED.nodes.registerType('Optex_Occupancy_Sensor', Optex_Occupancy_Sensor);
    }
};
