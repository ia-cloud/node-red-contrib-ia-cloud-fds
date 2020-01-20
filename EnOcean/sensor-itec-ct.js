const SensorInterface = require('./sensors-interface');

module.exports = class WattyTemperature extends SensorInterface {
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
        function Itec_CT_Sensor(config) {
            RED.nodes.createNode(this, config);
            this.sensor_id = config.sensor_id;
            // this.dataName0 = config.dataName0;
            // this.unitType0 = config.unitType0;

            var node = this;
            var confObj = config.configObject;
            this.dItems = {};
            if (confObj) {
                try {
                    this.dItems = JSON.parse(confObj);
                } catch (e) {
                    // nodeのエラーを通知してして終了
                    node.error("runtime:jsonerror", confObj);
                }
            } else {
                // nodeのエラーを通知してして終了
                node.error("runtime:jsonerror", confObj);
            }
            this.on("input", function (msg) {});
            this.on("close", function () {});
        }
        RED.nodes.registerType("Itec_CT_Sensor", Itec_CT_Sensor);
    }
};
