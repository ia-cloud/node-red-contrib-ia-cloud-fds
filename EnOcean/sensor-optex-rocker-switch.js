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

module.exports = class OptexRockerSwitch extends SensorInterface {
    /**
     * ロッカースイッチの状況取得.
     */
    static process(data) {
        const result = [];
        if (data.length < 2) {
            // 1Byte以上でなければ空リスト返却
            return result;
        }
        const dec = parseInt(data, 16);
        const bin = `00000000${dec.toString(2)}`.slice(-8); // 0パディング（8桁）
        // State of the energy bow
        const ebo = parseInt(bin.substr(0, 1), 2);
        // State I of rocker B
        const rbi = parseInt(bin.substr(4, 1), 2);
        // State O of rocker B
        const rbo = parseInt(bin.substr(5, 1), 2);
        // State I of rocker A
        const rai = parseInt(bin.substr(6, 1), 2);
        // State O of rocker A
        const rao = parseInt(bin.substr(7, 1), 2);

        if (ebo == 1) {
            result.push('pressed');
        } else {
            result.push('released');
        }
        if (rbi == 1) {
            result.push('pressed');
        } else {
            result.push('released');
        }
        if (rbo == 1) {
            result.push('pressed');
        } else {
            result.push('released');
        }
        if (rai == 1) {
            result.push('pressed');
        } else {
            result.push('released');
        }
        if (rao == 1) {
            result.push('pressed');
        } else {
            result.push('released');
        }

        return result;
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        function OptexRockerSW(config) {
            RED.nodes.createNode(this, config);
            this.sensorId = config.sensorId;
            this.configObject = config.configObject;

            this.on('input', function (msg) {});
            this.on('close', function () {});
        }
        RED.nodes.registerType('Optex_Rocker_SW', OptexRockerSW);
    }
};
