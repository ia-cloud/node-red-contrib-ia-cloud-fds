const SensorInterface = require('./sensors-interface');

module.exports = class urdAC extends SensorInterface {
    /**
     * 電流計算.
     */
    static process(data) {
        const ret = [];
        if (data.length < 4 * 2) {
            // 4Byte以上でなければ空リスト返却
            return ret;
        }
        const dec = parseInt(data, 16);
        const acList = [];
        const ad_val = (dec >> 8) & 0b1111111111;

        let K = 0;
        if (ad_val < 9) {
            K = (-0.0448 * ad_val) + 1.77;
        } else if (ad_val >= 9 && ad_val < 20) {
            K = (-0.0114 * ad_val) + 1.46;
        } else if (ad_val >= 20 && ad_val < 227) {
            K = (-0.000433 * ad_val) + 1.25;
        } else if (ad_val >= 227 && ad_val < 822) {
            K = (0.0000218 * ad_val) + 1.15;
        } else {
            K = (0.000365 * ad_val) + 0.86;
        }

        const E = 1.76;
        // CT径が10mm なのでc, d は以下の数値
        const c = 56;
        const d = 3000;

        const I = (ad_val * K * E * d) / (2.8 * c);
        const ac = I / 1000;
        acList.push(ac);

        return acList;
    }

    static nodeRedFunction(RED) {
        // collect-data-object config node function definition
        // collect-data-object config node function definition
        function UR_D_AC_Sensor(config) {
            RED.nodes.createNode(this, config);
            this.sensor_id = config.sensor_id;
            this.dataName = config.dataName;
            this.unitType = config.unitType;

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
        RED.nodes.registerType("UR_D_AC_Sensor", UR_D_AC_Sensor);
    }
};
