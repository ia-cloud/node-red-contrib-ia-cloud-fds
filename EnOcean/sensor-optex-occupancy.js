const SensorInterface = require('./sensors-interface');

module.exports = class OptexOccupancy extends SensorInterface {
    /**
     * 在室センサーの状況取得.
     */
    static process(data) {
        const result = [];
        if (data.length < 4 * 2) {
            // 4Byte以上でなければ空リスト返却
            return result;
        }

        // 4Byteのデータ長のうち先頭1Byte目が供給電圧、3Byte目が在室状態
        const dec = parseInt(data, 16);
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
            this.sensor_id = config.sensor_id;

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
        RED.nodes.registerType("Optex_Occupancy_Sensor", Optex_Occupancy_Sensor);
    }
};
