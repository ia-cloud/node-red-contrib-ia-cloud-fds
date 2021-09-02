"use strict";
var moment = require("moment");

// オムロン温調計ModbsアドレスMap
const OMRON_MAP = {
  hh: { device: "HR", dataAdd: 0x2406, mask: 0x0002 },
  ad: { device: "HR", dataAdd: 0x2406, mask: 0x0004 },
  hs: { device: "HR", dataAdd: 0x2406,mask: 0x0008 },
  se: { device: "HR", dataAdd: 0x2406, mask: 0x0040 },
  ct1: { device: "HR", dataAdd: 0x2406, mask: 0x0400 },
  ct2: { device: "HR", dataAdd: 0x2406, mask: 0x0800 },
  alm1: { device: "HR", dataAdd: 0x2406, mask: 0x1000 },
  alm2: { device: "HR", dataAdd: 0x2406, mask: 0x2000 },
  alm3: { device: "HR", dataAdd: 0x2406, mask: 0x4000 },
  evt1: { device: "HR", dataAdd: 0x2407, mask: 0x0001 },
  evt2: { device: "HR", dataAdd: 0x2407, mask: 0x0002 },
  evt3: { device: "HR", dataAdd: 0x2407, mask: 0x0004 },
  evt4: { device: "HR", dataAdd: 0x2407, mask: 0x0008 }
}
module.exports = function(RED) {

    function omronTempCtlrAE(config) {

        RED.nodes.createNode(this,config);

        var node = this;
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
            source = dataItem.AnE;
            device = OMRON_MAP[source].device;

            // このデバイスタイプが初めてなら追加
            if (!linkObj[device]) linkObj[device] = [];

            dataAdd = OMRON_MAP[source].dataAdd;
            linkData = {value: "", preValue: ""};
            linkData.address = dataAdd;
            linkData.nodeId = nId;
            linkData.objectKey = myObjKey;
            linkObj[device].push(linkData);
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
        var iaCloudObjectSend = function(objectKey) {

            // 自身のobjectKeyでなかったら何もしない。
            if(objectKey !== myObjKey) return;

            let msg = {request:"store", dataObject:{objectContent:{}}};
            let contentData = [];

            // PLC通信の設定Nodeでエラーが発生していれば、エラーステータスを表示し、なにもしない
            // 自身のNodeIDをセット。
            let obj = linkObj.error.find(lnkError => lnkError.nodeId === nodeId);
            let eMsg = obj.value;

            // using quality infomation
            if (config.qInfo) {
                if (eMsg !== "ok" && eMsg !== "" ) {
                    node.error(eMsg);
                    msg.dataObject.quality = "com. error";
                } else {
                    msg.dataObject.quality = "good";
                    node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});
                }
            } else {
                delete msg.dataObject.quality;
                if (eMsg !== "ok" && eMsg !== "" ) {
                    node.error(eMsg);
                    node.status({fill:"red",shape:"ring",text:"runtime.comError"});
                    return;
                }
            }

            msg.dataObject.objectKey = myObjKey;
            msg.dataObject.timestamp = moment().format();
            msg.dataObject.objectType = "iaCloudObject";
            msg.dataObject.objectDescription = config.objectDescription;
            msg.dataObject.objectContent.contentType = config.contentType;

            let source, device, dataAdd, mask;
            config.dataItems.forEach(function(dataItem, index) {

                source = dataItem.AnE;
                device = OMRON_MAP[source].device;
                dataAdd = OMRON_MAP[source].dataAdd;
                mask = OMRON_MAP[source].mask;
                let dItem = {
                    commonName: "alarm&Event",
                    dataValue: {
                        AnECode: dataItem.AnECode,
                        AnEDescription: dataItem.AnEDesc
                    }
                }
                dItem.dataValue.AnEStatus = "";

                // 対応するlinkDataを探し、0x表現の下4桁を取り出し、マスクしてBooleanに変換
                let lvalue = linkObj[device].find(function(lData){
                  return (lData.address == Number(dataAdd));});
                let value = !!(parseInt(lvalue.value.slice(-4), 16) & mask);
                let preValue = !!(parseInt(lvalue.preValue.slice(-4), 16) & mask);

                if (value) {dItem.dataValue.AnEStatus = (preValue)? "on": "set";}
                else {dItem.dataValue.AnEStatus = (!preValue)? "off": "reset";}

                contentData.push(dItem);
            });
            msg.dataObject.objectContent.contentData = contentData;
            msg.payload = contentData;
            node.send(msg);
            if (msg.dataObject.quality && msg.dataObject.quality !== "good")
                node.status({fill:"red",shape:"ring",text:"runtime.comError"});
            else
                node.status({fill:"green", shape:"dot", text:"runtime.sent"});
        }

        this.on("input",function(msg) {
            if (msg.payload) iaCloudObjectSend(myObjKey);
        });
        this.on("close",function() {
            clearInterval(sendObjectId);
        });
    }

    RED.nodes.registerType("tmp-ctrl-omron-AE",omronTempCtlrAE);

}
