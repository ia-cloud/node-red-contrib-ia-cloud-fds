"use strict";

const moment = require("moment");

// オムロン温調計ModbsアドレスMap
const OMRON_MAP = {
    pv: { device: "HR", dataAdd: 0x2402, dp: 0x2410, mask: null },
    sv: { device: "HR", dataAdd: 0x2403, dp: 0x2410, mask: null },
    pro: { device: "HR", dataAdd: 0x2a00, dp: 0x3309, mask: null },
    int: { device: "HR", dataAdd: 0x2a01, dp: 0x3309, mask: null },
    dir: { device: "HR", dataAdd: 0x2a02, dp: null, mask: null },
    run: { device: "HR", dataAdd: 0x2407, dp: null, mask: 0x0100 },
    am: { device: "HR", dataAdd: 0x2407, dp: null, mask: 0x0400 },
    at: { device: "HR", dataAdd: 0x2407, dp: null, mask: 0x0080 },
}
module.exports = function(RED) {

    function omronTempCtrl(config) {

        RED.nodes.createNode(this,config);

        let node = this;
        let items = config.dataItems;
        let myObjKey = config.objectKey;
        let nodeId = node.id;
        let linkObj = {};

        const mbCom = RED.nodes.getNode(config.ModbusCom);
        // 通信Nodeが存在しない場合
        if (!mbCom) {
            node.error("comNode not found");
            node.status({fill:"yellow",shape:"ring",text:"runtime.comNode"});
            return;
        }

        const minCycle = 10; // 最小収集周期を10秒に設定
        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        // linkObj structure
        //   {error:[], Coil:[], IS:[], IR:[], HR:[]};

        // エラーリンクデータを登録
        linkObj.error = [{address: 0, value: "", preValue: "", 
                        nodeId: nodeId, objectKey: myObjKey}];

        // 非同期収集無しの場合、自身のNodeIDをリセット。               
        let nId = (config.storeAsync)? nodeId: "";

        let source, device, dataAdd, linkData;
        // dataItemを一つづつ取り出し、ModbuslinkDataを設定
        items.forEach(function(dataItem, index) {
            source = dataItem.item;
            device = OMRON_MAP[source].device;

            // このデバイスタイプが初めてなら追加
            if (!linkObj[device]) linkObj[device] = [];

            dataAdd = OMRON_MAP[source].dataAdd;
            linkData = {value: "", preValue: ""};
            linkData.address = dataAdd;
            linkData.nodeId = nId;
            linkData.objectKey = myObjKey;
            linkObj[device].push(linkData);
            // 小数点位置が規定されていたら
            let dp = OMRON_MAP[source].dp;
            if (dp) {
                let dpData = {value: "", preValue: ""};
                dpData.address = dp;
                dpData.nodeId = nId;
                dpData.objectKey = myObjKey;
                linkObj[device].push(dpData);
            }
        });

        //modbusCom nodeのデータ追加メソッドを呼ぶ
        mbCom.emit("addLinkData", linkObj);

        // Nodeステータスを　Readyに
        node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // 定期収集のためのカウンターをセット
        let timeCount = config.storeInterval;

        let sendObjectId = setInterval(function(){
            // 設定された格納周期で,ModbusCom Nodeからデータを取得し、ia-cloudオブジェクトを
            // 生成しメッセージで送出
            if(config.storeInterval != "0") {
                // 収集周期前であれば何もせず
                timeCount = timeCount - minCycle;
                if (timeCount > 0) return;
                // 収集周期がきた。収集周期を再設定。
                timeCount = config.storeInterval;
                iaCloudObjectSend(myObjKey);
            }
        }, (minCycle * 1000));


        this.on("changeListener",function(objectKeys) {
            //登録したlinkObに変化があったら呼ばれる。
            //そのlinkObjを参照するia-cloudオブエクトをstoreする。
            objectKeys.forEach(function(key, idx) {
                iaCloudObjectSend(key);
            });
        });

        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして送出する関数
        const iaCloudObjectSend = function(objectKey) {

            // 自身のobjectKeyでなかったら何もしない。
            if(objectKey !== myObjKey) return;

            // PLC通信の設定Nodeでエラーが発生していれば、エラーステータスを表示し、なにもしない
            // 自身のNodeIDをセット。

            let obj = linkObj.error.find(lnkError => lnkError.nodeId === nodeId);
            let eMsg = obj.value;
            if (eMsg !== "ok" && eMsg !== "" ) {
                node.error(eMsg);
                node.status({fill:"red",shape:"ring",text:"runtime.comError"});
                return;
            }

            node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

            let msg = {request:"store", dataObject:{objectContent:{}}};
            let contentData = [];

            msg.dataObject.objectKey = myObjKey;
            msg.dataObject.timestamp = moment().format();
            msg.dataObject.objectType = "iaCloudObject";
            msg.dataObject.objectDescription = config.objectDescription;
            msg.dataObject.objectContent.contentType = config.contentType;

            let source, device, dataAdd;
            config.dataItems.forEach(function(dataItem, index) {

                source = dataItem.item;
                device = OMRON_MAP[source].device;
                dataAdd = OMRON_MAP[source].dataAdd;
                let dItem = {
                    dataName: dataItem.dataName,
                    dataValue: null,
                    unit: dataItem.unit
                };

                // 対応するlinkDataを探し、0x表現の下4桁を取り出しす
                let value = linkObj[device]
                      .find(function(lData){
                        return (lData.address == Number(dataAdd));}).value.slice(-4);
                let mask = OMRON_MAP[source].mask;
                let dp = OMRON_MAP[source].dp;
                let dpValue;
                if (dp) {
                    // 小数点位置を調整
                    dpValue = linkObj[device]
                        .find(function(lData){ return (lData.address == dp); }).value.slice(-4)
                    dpValue = parseInt(dpValue, 16);
                    // 2の歩数に変換し倍率をかける
                    dItem.dataValue = (-1 - ~parseInt(value, 16)) / 10**dpValue;
                } else {
                    dItem.dataValue = (-1 - ~parseInt(value, 16));               
                }
                if(mask){
                    // マスクしてBooleanに変換
                    dItem.dataValue = !!(parseInt(value, 16) & mask);
                }
                contentData.push(dItem);
            });
            msg.dataObject.objectContent.contentData = contentData;
            msg.payload = contentData;
            node.send(msg);
            node.status({fill:"green", shape:"dot", text:"runtime.sent"});
        }

        this.on("input",function(msg) {
            if (msg.payload) iaCloudObjectSend(myObjKey);
        });

        this.on("close",function() {
            clearInterval(sendObjectId);
        });
    }

    RED.nodes.registerType("tmp-ctrl-omron",omronTempCtrl);

}
