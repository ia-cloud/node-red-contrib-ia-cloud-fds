/**
 * (C) 2020 URD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const SensorInterface = require('./sensors-interface');

module.exports = class UrdAC1ch extends SensorInterface {
    /**
     * 電流計算およびcontentDataの生成.
     */
    static process(data, contentDataConfig) {
        const dataLength = 8; // 4Byte * 2

        if (typeof data === 'undefined' || data.replace('0x', '').length < dataLength) {
            // 4Byte以上でなければ送信対象外のデータとし、sendFlg: falseのデータを返却
            return { contentData: [], message: '', sendFlg: false };
        }

        // 処理に必要なデータ長を抽出
        const fixedLengthData = data.replace('0x', '').slice(0, dataLength);
        // Decode to decimal value. ex. 'FFF' => 4095
        const dec = parseInt(fixedLengthData, 16);
        // eslint-disable-next-line no-bitwise
        const adVal = (dec >> 8) & 0b1111111111;

        let K = 0;
        if (adVal < 9) {
            K = (-0.0448 * adVal) + 1.77;
        } else if (adVal >= 9 && adVal < 20) {
            K = (-0.0114 * adVal) + 1.46;
        } else if (adVal >= 20 && adVal < 227) {
            K = (-0.000433 * adVal) + 1.25;
        } else if (adVal >= 227 && adVal < 822) {
            K = (0.0000218 * adVal) + 1.15;
        } else {
            K = (0.000365 * adVal) + 0.86;
        }

        const E = 1.76;
        // CT径が10mm なのでc, d は以下の数値
        const c = 56;
        const d = 3000;

        const I = (adVal * K * E * d) / (2.8 * c);
        const ac = I / 1000;

        // contentDataの生成
        const contentData = contentDataConfig.slice(0, 1).map((dItem) => {
            // 小数第3位を四捨五入して代入
            const dataValue = Math.round(ac * 100) / 100;

            return {
                dataName: dItem.dataName,
                dataValue,
                unit: dItem.unit,
            };
        }).filter((dItem) => dItem);

        return { contentData, message: '', sendFlg: true };
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function AC1chSensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;
            this.configObject = config.configObject;

            // const node = this;

            this.on('input', (msg, send, done) => done()); // 処理なし

            this.on('close', () => {});
        }
        RED.nodes.registerType('URD AC 1ch sensor', AC1chSensor);
    }
};
