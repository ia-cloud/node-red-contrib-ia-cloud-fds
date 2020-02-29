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
    var request = require("request");
    var moment = require("moment");

    function PLCModbusAE(config) {

        RED.nodes.createNode(this,config);
        var node = this;
        var AnEObjects = [{}];
        var storeObj;
        var mbCom = (RED.nodes.getNode(config.ModbusCom));
        var minCycle = 10; // 最小収集周期を10秒に設定
        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        // 設定ObjectsをconfigJsonプロパティからパース
        try{
          AnEObjects = JSON.parse(config.configJson);
        } catch(e) {
          //エラーの場合は、nodeステータスを変更。
          node.status({fill:"red",shape:"ring",text:"runtime.badFilePath"});
          node.error(RED._("runtime.badFilePath"), config.configObjects);
          AnEObjects = null;
        }

        if (AnEObjects) {
            // configObjから通信するPLCデバイス情報を取り出し、ModbusCom Nodeに追加
            var linkObj = {Coil:[], IS:[], IR:[], HR:[]};
            var address = "";
            AnEObjects.forEach(function(objItem, idx) {
              // 定期収集のためのカウンターをセット
              objItem.options.timeCount = objItem.options.storeInterval;
              // データItemを設定
              objItem.ObjectContent.contentData.forEach(function(dataItem, index) {
                var options = dataItem.options;
                var linkData = {};
                linkData.address = options.source;
                linkData.nodeId = node.id;
                linkData.objectKey = objItem.objectKey;
                if (options.deviceType == "Coil") linkObj.Coil.push(linkData);
                else if (options.deviceType == "IS") linkObj.IS.push(linkData);
                else if (options.deviceType == "IR") linkObj.IR.push(linkData);
                else if (options.deviceType == "HR") linkObj.HR.push(linkData);
              });
            });
            //modbusCom nodeのデータ追加メソッドを呼ぶ
            mbCom.emit("addLinkData", linkObj);

            // Nodeステータスを　Readyに
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

            var sendObjectId = setInterval(function(){
              // 設定された格納周期で,ModbusCom Nodeからデータを取得し、ia-cloudオブジェクトを
              // 生成しメッセージで送出
              // 複数の周期でオブジェクトの格納をするため、10秒周期でカウントし、カウントアップしたら、
              // オブジェクト生成、メッセージ出力を行う。
              AnEObjects.forEach(function(objItem, idx) {
                if(objItem.options.storeInterval != "0") {
                  // 収集周期前であれば何もせず
                  objItem.options.timeCount = objItem.options.timeCount - minCycle;
                  if (objItem.options.timeCount > 0) return;
                  // 収集周期がきた。収集周期を再設定。
                  objItem.options.timeCount = objItem.options.storeInterval;
                  iaCloudObjectSend(objItem.objectKey);
                }
              });
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
        var iaCloudObjectSend = function(objectKey) {

          node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

          var msg = {request: "store", dataObject:{ObjectContent:{}}};
          var contentData = [];

          var iaObject = AnEObjects.find(function(objItem, idx) {
            return (objItem.objectKey == objectKey);
          });
          msg.dataObject.objectKey = objectKey;
          msg.dataObject.timeStamp = moment().format();
          msg.dataObject.objectType = "iaCloudObject";
          msg.dataObject.objectDescription = iaObject.objectDescription;
          msg.dataObject.ObjectContent.contentType = "Alarm&Event";

          iaObject.ObjectContent.contentData.forEach(function(dataItem, index) {
              // 対象のデータアイテムのシャローコピーを作成
              var dItem = Object.assign( {}, dataItem);
              var deviceType = dataItem.options.deviceType;
              var source = dataItem.options.source;
              var logic = dataItem.options.logic;
              delete dItem.options;
              dItem.dataValue.AnEStatus = "";

              var lvalue = linkObj[deviceType].find(function(lData){
                return (lData.address == Number(source));});
              var value = lvalue.value;
              var preValue = lvalue.preValue;

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

          msg.dataObject.ObjectContent.contentData = contentData;
          msg.payload = RED._("runtime.sent");
          node.send(msg);
          node.status({fill:"green", shape:"dot", text:"runtime.sent"});
        }

        this.on("input",function(msg) {
            if (msg.payload) {
              dataObjects.forEach(function(objItem, idx) { 
                  iaCloudObjectSend(objItem.objectKey);
              });
            }
        });
        this.on("close",function() {
          clearInterval(sendObjectId);
        });
    }

    RED.nodes.registerType("PLC-Modbus-AE",PLCModbusAE);

}
