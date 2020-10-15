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
    static process(serialData, contentDataFormat, range) {
        let message = '';
        const contentData = [];

        if (typeof serialData === 'undefined' || serialData.length < 5 * 2) {
            // 5Byte以上でなければ送信対象外のデータとし、sendFlg: falseのデータを返却
            return { contentData, message, sendFlg: false };
        }

        // contentDataの生成
        contentDataFormat.every((dItem, idx) => {
            if (idx >= 3) {
                return false;
            }
            const dec = parseInt(serialData.substr(idx * 3, 3), 16);
            if (Number.isNaN(range[idx])) {
                // センサー未設定としたチャンネルに測定値(最大値以外)がある場合に警告メッセージを追加
                if (dec !== 4095) {
                    message += `Ch${idx + 1}:no setting.`;
                }
                return true;
            }
            // センサー設定を行ったチャンネルが最大値(センサー未装着時のデータ)の場合に警告メッセージを追加し、値を9999.99とする
            if (dec === 4095) {
                message += `Ch${idx + 1}:sensor unconnected.`;
                dItem.dataValue = 9999.99;
            } else {
                const clampRange = (typeof range[idx] === 'number') ? range[idx] : 400;
                // 倍率計算を行い、小数第3位を四捨五入して代入
                dItem.dataValue = Math.round((dec * clampRange * 100) / 4095) / 100;
            }
            contentData.push(dItem);
            return true;
        });

        return { contentData, message, sendFlg: true };
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function AC3chSensor(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;

            const node = this;
            const confObj = config.configObject;
            this.range = [];
            this.dItems = {};
            if (confObj && config.range) {
                try {
                    this.dItems = JSON.parse(confObj);
                    // 3ch sensorに設定された倍率を取得. 文字列を数値配列に変換. センサー未設定の場合はNaNとする
                    const rangeRegExp = new RegExp('[\\[\\]\\"\'\\s]', 'g');
                    this.range = (config.range) ? config.range.replace(rangeRegExp, '').split(',').map(Number) : [];
                } catch (e) {
                    // nodeのエラーを通知してして終了
                    node.error('runtime:jsonerror', config);
                }
            } else {
                // nodeのエラーを通知してして終了
                node.error('runtime:jsonerror', config);
            }

            this.on('input', (msg, send, done) => done()); // 処理なし

            this.on('close', () => {});
        }
        RED.nodes.registerType('URD AC 3ch sensor', AC3chSensor);
    }
};
