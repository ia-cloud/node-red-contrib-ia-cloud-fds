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
    static process(data, contentDataFormat) {
        if (typeof data === 'undefined' || data.length < 4 * 2) {
            // 4Byte以上でなければ送信対象外のデータとし、sendFlg: falseのデータを返却
            return { contentData: [], message: '', sendFlg: false };
        }
        const dec = parseInt(data, 16);
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

        const contentData = contentDataFormat.map((dItem) => {
            // 小数第3位を四捨五入して代入
            dItem.dataValue = Math.round(ac * 100) / 100;
            return dItem;
        });

        return { contentData, message: '', sendFlg: true };
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function AC1chSensor(config) {
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
            this.on('input', (msg, send, done) => done()); // 処理なし
            this.on('close', () => {});
        }
        RED.nodes.registerType('URD AC 1ch sensor', AC1chSensor);
    }
};
