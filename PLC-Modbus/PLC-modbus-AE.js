/**
 * Copyright JS Foundation and other contributors, http://js.foundation
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
 **/

module.exports = function(RED) {
    "use strict";
    const moment = require("moment");
    let intervalId;
    
    function PLCModbusAE(config) {

        RED.nodes.createNode(this,config);
        const node = this;

        // Nodeのconfigパラメータから、AnEデータタイプのデータオブジェクトを生成
        let AnEItems = [];
        let AnEItem = {
            commonName:"Alarm&Event",
            dataValue:{AnEStatus: "",AnECode: "",AnEDescription:""}, 
            options:{deviceType:"coil",address:0, logic:"pos"}
        };
        for (let i = 0; i <config.AnEItems.length; i++ ) {
            AnEItem.dataValue.AnECode = config.AnEItems[i].AnECode;
            AnEItem.dataValue.AnEDescription = config.AnEItems[i].AnEDescription;
            AnEItem.options.deviceType = config.AnEItems[i].deviceType;
            AnEItem.options.address = config.AnEItems[i].address;
            AnEItem.options.logic = config.AnEItems[i].logic;

            AnEItems.push(AnEItem);
        };
        //Nodeのconfigパラメータから、iaCloudオブジェクトを生成
        let AnEObject
            = {
                objectKey: config.objectKey,
                objectType: "iaCloudObject",
                objectDescription: config.objectDescription,
                objectContent: {
                    contentType: "Alarm&Event",
                    contentData: AnEItems
                }
            };
        // comNodeと通信するPLCデバイス情報を共有するオブジェクト定義
        let linkObj = {Coil:[], IS:[], IR:[], HR:[]};

        const mbCom = (RED.nodes.getNode(config.ModbusCom));
        const minCycle = 10; // 最小収集周期を10秒に設定
        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        if (AnEObject) {
            
            let address = "";

            // 定期収集のためのカウンターをセット
            let timeCount = config.storeInterval;

            // 設定から通信するPLCデバイス情報を取り出し、ModbusCom Nodeに追加
            AnEObject.objectContent.contentData.forEach(function(AnEItem, index) {
                const options = AnEItem.options;
                let linkData = {};
                linkData.address = options.address;
                linkData.nodeId = node.id;
                linkData.objectKey = AnEObject.objectKey;
                if (options.deviceType == "Coil") linkObj.Coil.push(linkData);
                else if (options.deviceType == "IS") linkObj.IS.push(linkData);
                else if (options.deviceType == "IR") linkObj.IR.push(linkData);
                else if (options.deviceType == "HR") linkObj.HR.push(linkData);
            });

            //modbusCom nodeのデータ追加メソッドを呼ぶ
            mbCom.emit("addLinkData", linkObj);

            // Nodeステータスを　Readyに
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

            intervalId = setInterval(function(){
                // 設定された格納周期で,ModbusCom Nodeからデータを取得し、ia-cloudオブジェクトを
                // 生成しメッセージで送出
                // 複数の周期でオブジェクトの格納をするため、10秒周期でカウントし、カウントアップしたら、
                // オブジェクト生成、メッセージ出力を行う。

                if(config.storeInterval != "0") {
                    // 収集周期前であれば何もせず
                    timeCount -= minCycle;
                    if (timeCount > 0) return;
                    // 収集周期がきた。収集周期を再設定。
                    timeCount = config.storeInterval;
                    iaCloudObjectSend(AnEObject.objectKey);
                }

            }, (minCycle * 1000));
        }

        this.on("changeListener",function(objectKeys) {
            //登録したlinkObに変化があったら呼ばれる。
            //そのlinkObjを参照するia-cloudオブエクトをstoreする。
            objectKeys.forEach(function(key, idx) {
                iaCloudObjectSend(key);
            });
        });

        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして早出する関数
        const iaCloudObjectSend = function(objectKey) {

            // 自身のobjectKeyでなかった、ら何もしない。
            if(!objectKey == AnEObject.objectKey) return;

            node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

            let msg = {request: "store", dataObject:{objectContent:{}}};
            let contentData = [];

            msg.dataObject.objectKey = AnEObject.objectKey;
            msg.dataObject.timeStamp = moment().format();
            msg.dataObject.objectType = "iaCloudObject";
            msg.dataObject.objectDescription = AnEObject.objectDescription;
            msg.dataObject.objectContent.contentType = "Alarm&Event";

            AnEItems.forEach(function(dataItem, index) {
                // 対象のデータアイテムのシャローコピーを作成
                let dItem = Object.assign( {}, dataItem);
                const deviceType = dataItem.options.deviceType;
                const address = dataItem.options.address;
                const logic = dataItem.options.logic;
                delete dItem.options;
                dItem.dataValue.AnEStatus = "";

                let lvalue = linkObj[deviceType].find(function(lData){
                  return (lData.address == Number(address));});
                let value = lvalue.value;
                let preValue = lvalue.preValue;

                if(deviceType == "coil" || deviceType == "IS") {
                  value = (value == "0") ? false : true;
                  preValue = (preValue == "0") ? false : true;
                }
                if(deviceType == "IR" || deviceType == "HR") {
                  value = (value == "0x0000") ? false : true;
                  preValue = (preValue == "0x0000") ? false : true;
                }
                if (logic == "neg") {
                  value = !value;
                  preValue = !preValue;
                }
                if (value) {dItem.dataValue.AnEStatus = (preValue)? "on": "set";}
                else {dItem.dataValue.AnEStatus = (!preValue)? "off": "reset";}
                contentData.push(dItem);
            });

            msg.dataObject.objectContent.contentData = contentData;
            msg.payload = RED._("runtime.sent");
            node.send(msg);
            node.status({fill:"green", shape:"dot", text:"runtime.sent"});
        }

        this.on("input",function(msg) {
            if (msg.payload) iaCloudObjectSend(AnEObject.objectKey);
        });
        this.on("close",function() {
            clearInterval(intervalId);
        });
    }

    RED.nodes.registerType("PLC-Modbus-AE",PLCModbusAE);

}
