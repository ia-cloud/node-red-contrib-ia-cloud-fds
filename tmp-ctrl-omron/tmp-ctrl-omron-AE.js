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

    const iconv = require("iconv-lite");

    function omronTempCtlrAE(config) {

        RED.nodes.createNode(this,config);

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
        var node = this;
        var dataObjects = [{}];
        var storeObj;
        var mbCom = RED.nodes.getNode(config.ModbusCom);
        var minCycle = 10; // 最小収集周期を10秒に設定
        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});
        // 設定ObjectsをconfigJsonプロパティからパース
        try{
          dataObjects = JSON.parse(config.configJson);
        } catch(e) {
          //エラーの場合は、nodeステータスを変更。
          node.status({fill:"red",shape:"ring",text:"runtime.badFilePath"});
          node.error(RED._("runtime.badFilePath"), config.configObjects);
          dataObjects = null;
        }

        // configObjから通信するPLCデバイス情報を取り出し、ModbusCom Nodeに追加
        if (dataObjects) {
            var linkObj = {Coil:[], IS:[], IR:[], HR:[]};
            dataObjects.forEach(function(objItem, idx) {
              var objectKey = objItem.objectKey;
              var nodeId = (objItem.options.storeAsync)? node.id: "";
              // 定期収集のためのカウンターをセット
              objItem.options.timeCount = objItem.options.storeInterval;

              objItem.ObjectContent.contentData.forEach(function(dataItem, index) {
                var source = dataItem.options.source;
                var device = OMRON_MAP[source].device;
                var dataAdd = OMRON_MAP[source].dataAdd;
                var linkData = {address: "", value: "", preValue: "", nodeId: null, objectKey: ""};
                linkData.address = dataAdd;
                linkData.nodeId = nodeId;
                linkData.objectKey = objectKey;
                linkObj[device].push(linkData);
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

              dataObjects.forEach(function(objItem, idx) {
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

        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして送出する関数
        var iaCloudObjectSend = function(objectKey) {

          node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

          var msg = {request:"store", dataObject:{ObjectContent:{}}};
          var contentData = [];

          var iaObject = dataObjects.find(function(objItem, idx) {
            return (objItem.objectKey == objectKey);
          });
          msg.dataObject.objectKey = objectKey;
          msg.dataObject.timeStamp = moment().format();
          msg.dataObject.objectType = "iaCloudObject";
          msg.dataObject.objectDescription = iaObject.objectDescription;
          msg.dataObject.ObjectContent.contentType = iaObject.ObjectContent.contentType;

          iaObject.ObjectContent.contentData.forEach(function(dataItem, index) {
              // 対象のデータアイテムのシャローコピーを作成
              var dItem = Object.assign( {}, dataItem);
              var source = dItem.options.source;
              delete dItem.options;

              var device = OMRON_MAP[source].device;
              var dataAdd = OMRON_MAP[source].dataAdd;
              var mask = OMRON_MAP[source].mask;
              dItem.dataValue.AnEStatus = "";


             // 対応するlinkDataを探し、0x表現の下4桁を取り出し、マスクしてBooleanに変換
              var lvalue = linkObj[device].find(function(lData){
                return (lData.address == Number(dataAdd));});
              var value = !!(parseInt(lvalue.value.slice(-4), 16) & mask);
              var preValue = !!(parseInt(lvalue.preValue.slice(-4), 16) & mask);

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
          //何もしない
        });
        this.on("close",function() {
          clearInterval(sendObjectId);
        });
    }

    RED.nodes.registerType("tmp-ctrl-omron-AE",omronTempCtlrAE);

}
