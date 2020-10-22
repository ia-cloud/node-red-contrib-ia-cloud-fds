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

module.exports = class UrdAC3ch extends SensorInterface {

    /**
     * 電流計算およびcontentDataの生成.
     */
    static process(serialData, contentDataConfig) {
        const presetRange = {
            WLS50: 400,
            WLS100: 400,
            WLS250: 400,
            WLS600: 700,
        };

        let message = '';

        if (typeof serialData === 'undefined' || serialData.length < 5 * 2) {
            // 5Byte以上でなければ送信対象外のデータとし、sendFlg: falseのデータを返却
            return { contentData: [], message, sendFlg: false };
        }

        // contentDataの生成
        const contentData = contentDataConfig.slice(0, 3).map((dItem, index) => {
            // Decode to decimal value. ex. 'FFF' => 4095
            const dec = parseInt(serialData.substr(index * 3, 3), 16);

            if (dItem.clampType === 'unconnected') {
                // センサー未設定としたチャンネルに測定値(最大値以外)がある場合に警告メッセージを追加
                if (dec !== 0xFFF) {
                    message += `Ch${index + 1}:no setting.`;
                }
                return undefined;
            }

            // センサー設定を行ったチャンネルが最大値(センサー未装着時のデータ)の場合に警告メッセージを追加し、値を9999.99とする
            let dataValue;
            if (dec === 0xFFF) {
                message += `Ch${index + 1}:sensor unconnected.`;
                dataValue = 9999.99;
            } else {
                const clampRange = dItem.rangeInput || presetRange[dItem.clampType] || 400;
                // 倍率計算を行い、小数第3位を四捨五入して代入
                dataValue = Math.round((dec * clampRange * 100) / 0xFFF) / 100;
            }

            return {
                dataName: dItem.dataName,
                dataValue,
                unit: dItem.unit,
            };
        }).filter((dItem) => dItem);

        return { contentData, message, sendFlg: true };
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function AC3chSensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;
            this.configObject = config.configObject;

            // const node = this;

            this.on('input', (msg, send, done) => done()); // 処理なし

            this.on('close', () => {});
        }
        RED.nodes.registerType('URD AC 3ch sensor', AC3chSensor);
    }
};
