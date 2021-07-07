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
        let latestLinkObj;

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
        let linkObj = {
            sensorId,
            nodeId,
            objectKey
        };

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
                if(latestLinkObj) {
                    iaCloudObjectSend(latestLinkObj);
                }
            }
        }, (minCycle * 1000));

        this.on("changeListener", (objectKey) => {
            //登録したlinkObに変化があったら呼ばれる。
            //そのlinkObjを参照するia-cloudオブエクトをstoreする。
            if(config.storeAsync) {
                iaCloudObjectSend(linkObj, null, true);
            }
            latestLinkObj = JSON.parse(JSON.stringify(linkObj));    // copy linkObj to latestLinkObj
        });

        this.on("input", (msg, send, done) => {
            if(msg.payload) {
                if(latestLinkObj) {
                    iaCloudObjectSend(latestLinkObj, msg);
                }
            }
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
        const iaCloudObjectSend = (obj, msg = undefined, storeAsync = false) => {
            
            // 自身のobjectKeyでなかったら何もしない。
            if(obj.objectKey !== objectKey) return;

            node.status({ fill: 'blue', shape: 'ring', text: 'runtime.preparing' });

            if(!msg) msg = {};
            msg.request = 'store';

            const preParsedData = latestLinkObj ? parseDataDL(latestLinkObj) : undefined;
            const parsedData = parseDataDL(obj);

            if (parsedData) {
                node.debug(`parsedData = ${JSON.stringify(parsedData)}`);

                let contentData = [];

                // storeAsyncがtrueの場合は、変化があった場合のみ通信することになるため、
                // ユーザーが設定したデータに変化があったかどうかチェックする
                if( storeAsync && preParsedData) {
                    let changeFlg = false;
                    config.dataItems.forEach((dataItem, index) => {
                        if( preParsedData[dataItem.item] !== parsedData[dataItem.item]) {
                            changeFlg = true;
                        }
                    })
                    // ユーザーが設定したデータに変化がなかったため処理を終える
                    if(!changeFlg) {
                        node.status({ fill: 'green', shape: 'dot', text: 'status.received' });
                        return;
                    }
                }

                config.dataItems.forEach((dataItem, index) => {
                    // dataItem
                    //     item: データ項目(CH1, CH2, CH3, CH4, bat, fw, rssi)
                    //     dataName: データ名
                    //     unit: 単位(rssiのときのみdBmを付与)

                    let dItem = {
                        dataName: dataItem.item,
                        dataValue: parsedData[dataItem.item]
                    };
                    if(dataItem.item === 'rssi') {
                        dItem.unit = 'dBm';
                    }
    
                    contentData.push(dItem);
                });

                msg.dataObject = {
                    objectKey: obj.objectKey,
                    timeStamp: moment().format(),
                    objectType: 'iaCloudObject',
                    objectDescription: config.objectDescription,
                    objectContent: {
                        contentType: config.contentType,
                        contentData
                    }
                };
                msg.payload = contentData;

                node.send(msg);

                node.status({ fill: 'green', shape: 'dot', text: 'status.received' });
            } else {
                node.log('!!! 受信したデータが正しくありません(Tech-inパケットか、ヘルスチェックのDATAパケットの可能性があります) !!!');
                node.status({ fill: 'green', shape: 'dot', text: 'status.received' });
            }
        };

        const SIGNAL_STATUS_TABLE = {
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
        const parseDataDL = (obj) => {
            const data = obj.value;
            if(data.length !== 10) {    // 0xNNNNNNNNの文字列
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
            const data1 = parseInt(data.substring(2, 4), 16);
            const data2 = parseInt(data.substring(4, 6), 16);
            const data3 = parseInt(data.substring(6, 8), 16);
            const [heartBeat, bat, CH1, CH2, CH3, CH4, fw] = [
                (data1 & 0b11000000) >> 6,
                BAT_STATUS_TABLE[(data1 & 0b00110000) >> 4],
                SIGNAL_STATUS_TABLE[(data1 & 0b00001111) >> 0],
                SIGNAL_STATUS_TABLE[(data2 & 0b11110000) >> 4],
                SIGNAL_STATUS_TABLE[(data2 & 0b00001111) >> 0],
                SIGNAL_STATUS_TABLE[(data3 & 0b11110000) >> 4],
                (data3 & 0b00001111) >> 0,
            ];
            if(heartBeat === 1) {
                node.debug("Signal Watcher Heart Beart received");
            }
            const rssi = Number(obj.optionalData);
            return {bat, CH1, CH2, CH3, CH4, fw, rssi};
        }
    }

    RED.nodes.registerType("signal-watcher", signalWatcher);
}
