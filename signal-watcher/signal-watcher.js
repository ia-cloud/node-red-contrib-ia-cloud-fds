"use strict";

const moment = require('moment');

module.exports = function(RED) {

    function signalWatcher(config) {

        RED.nodes.createNode(this,config);

        let node = this;
        let objectKey = config.objectKey;
        let sensorId = config.enOceanId;
        let nodeId = node.id;
        const { serialPool } = config.enOceanCom;
        // 最後にEnOceanComから受け取ったデータを保持する(定期収集に対応するため)
        let latestElement;

        const enOceanCom = RED.nodes.getNode(config.enOceanCom);
        // enOceanの設定ノードが存在しない場合
        if(!enOceanCom) {
            node.log(`[ERROR] EnOcean-com node is not specified. [object = ${enoceanCom}]`);
            node.status({ fill: 'red', shape: 'ring', text: 'status.noEnOceanCom' });
            return false;
        }

        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        // linkObjを登録
        let linkObj = [{
            sensorId,
            nodeId,
            objectKey
        }];

        //ebOceanCom nodeのデータ追加メソッドを呼ぶ
        enOceanCom.emit("addLinkData", linkObj);

        // Nodeステータスを　Readyに
        node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // 最小収集周期を10秒に設定
        const minCycle = 10;
        // 定期収集のためのカウンターをセット
        let timeCount = Number(config.storeInterval);
        let sendObjectId = setInterval(() => {
            // 設定された格納周期でEnOceanCom Nodeからデータを取得し、ia-cloudオブジェクトを
            // 生成しメッセージで送出
            if(!["", "0"].includes(config.storeInterval)) {
                // 収集周期前であれば何もせず
                timeCount = timeCount - minCycle;
                if (timeCount > 0) return;
                // 収集周期がきた。収集周期を再設定。
                timeCount = Number(config.storeInterval);
                if(latestElement) {
                    iaCloudObjectSend(latestElement);
                }
            }
        }, (minCycle * 1000));

        this.on("linkDatachangeListener", (element) => {
            // 引数に [objectKey, radio_data] を受け取る
            latestElement = element;
            if(config.storeAsync) {
                iaCloudObjectSend(element);
            }
        });

        this.on("input", (msg, send, done) => {
            if(msg.payload) iaCloudObjectSend(objectKey, msg);
            done();
        });

        this.on("close",(done) => {
            clearInterval(sendObjectId);
            if (this.serialConfig) {
                // TODO: ここのserialPoolをSerialPortノードから取得するようにする
                serialPool.close(this.serialConfig.serialport, done);
                done();
            } else {
                done();
            }
        });

        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして送出する関数
        const iaCloudObjectSend = (element, msg = undefined) => {
            node.status({ fill: 'blue', shape: 'ring', text: 'runtime.preparing' });

            if(!msg) msg = {};
            msg.request = 'store';

            const parsedData = parseDataDL(element[1]);

            if (parsedData) {
                node.debug(`parsedData = ${JSON.stringify(parsedData)}`);

                let contentData = [];
                config.dataItems.forEach((dataItem, index) => {
                    // dataItem
                    //     item: データ項目(CH1, CH2, CH3, CH4, bat, fw)
                    //     dataName: データ名
                    //     unit: 単位

                    let dItem = {
                        dataName: dataItem.dataName,
                        dataValue: parsedData[dataItem.item],
                        unit: dataItem.unit
                    };
    
                    contentData.push(dItem);
                });

                msg.dataObject = {
                    objectKey: element[0],
                    timeStamp: moment().format(),
                    objectType: 'iaCloudObject',
                    objectDescription: config.objectDescription,
                    objectContent: {
                        contentType: config.contentType,
                        contentData: contentData
                    }
                };
                msg.payload = parsedData;

                node.send(msg);

                node.status({ fill: 'green', shape: 'dot', text: 'status.received' });
            } else {
                node.log('!!! 受信したデータが正しくありません(Tech-inパケットか、ヘルスチェックのDATAパケットの可能性があります) !!!');
            }
        };

        const LIGHT_STATUS_TABLE = {
            0b0000: "off",
            0b0001: "on",
            0b0011: "slowBlink",
            0b0111: "fastBlink",
            0b1000: "momentaryOff",
            0b1001: "momentaryOn"
        };
        const BAT_STATUS_TABLE = {
            0b01: "low", 0b10: "mid", 0b11: "high"
        };
        const parseDataDL = (data) => {
            if(data.length !== 4) {
                // Dataパケットではないため何もしない
                return;
            }
            // 期待するデータの構造
            // データ1
            //      Bit7-6: Heart Beat [00: 通常データ信号, 01: 死活監視信号]
            //      Bit5-4: Batt. Status [01: Low, 10: Mid, 11: High ]
            //      Bit3-0: CH1 Light Status [0000: 消灯・点滅なし, 0001: 点灯・点滅なし, 0011: 点灯・低速点滅, 0111: 点灯・高速点滅, 1000: 点灯中に瞬時消灯, 1001: 消灯中に瞬時点灯]
            // データ2
            //      Bit7-4: CH2 Light Status [0000: 消灯・点滅なし, 0001: 点灯・点滅なし, 0011: 点灯・低速点滅, 0111: 点灯・高速点滅, 1000: 点灯中に瞬時消灯, 1001: 消灯中に瞬時点灯]
            //      Bit3-0: CH3 Light Status [0000: 消灯・点滅なし, 0001: 点灯・点滅なし, 0011: 点灯・低速点滅, 0111: 点灯・高速点滅, 1000: 点灯中に瞬時消灯, 1001: 消灯中に瞬時点灯]
            // データ3
            //      Bit7-4: CH4 Light Status [0000: 消灯・点滅なし, 0001: 点灯・点滅なし, 0011: 点灯・低速点滅, 0111: 点灯・高速点滅, 1000: 点灯中に瞬時消灯, 1001: 消灯中に瞬時点灯]
            //      Bit3-0: F/W Ver. [0000: Ver.1 〜 1111: Ver.16]
            // CRC
            const data1 = parseInt(data.substring(0, 2), 16);
            const data2 = parseInt(data.substring(2, 2), 16);
            const data3 = parseInt(data.substring(4, 2), 16);
            const [heartBeat, bat, CH1, CH2, CH3, CH4, fw] = [
                (data1 & 0b11000000) >> 6,
                BAT_STATUS_TABLE[(data1 & 0b00110000) >> 4],
                LIGHT_STATUS_TABLE[(data1 & 0b00001111) >> 0],
                LIGHT_STATUS_TABLE[(data2 & 0b11110000) >> 4],
                LIGHT_STATUS_TABLE[(data2 & 0b00001111) >> 0],
                LIGHT_STATUS_TABLE[(data3 & 0b11110000) >> 4],
                (data3 & 0b00001111) >> 0,
            ];
            if(heartBeat === 1) {
                // Heart Beatのデータであれば無視する
                return;
            }
            return {bat, CH1, CH2, CH3, CH4, fw};
        }
    }

    RED.nodes.registerType("signal-watcher", signalWatcher);
}
