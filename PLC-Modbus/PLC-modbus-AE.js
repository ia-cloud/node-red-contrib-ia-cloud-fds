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
    var fs = require("fs");

    function PLCModbusAE(config) {

        RED.nodes.createNode(this,config);

        var node = this;
        var AnEObjects = [{}];
        var storeObj;
        var mbCom = (RED.nodes.getNode(config.ModbusCom));
        var minCycle = 10; // 最小収集周期を10秒に設定

        if (config.confsel == "fileSet"){
          // 設定ファイルの場合、ファイルを読み込んで、オブジェクトに展開
          try{
            AnEObjects = JSON.parse(fs.readFileSync(config.configfile,'utf8'))
              .AnEObjects;
          } catch(e) {
            //エラーの場合は、nodeステータスを変更。
            node.status({fill:"red",shape:"ring",text:"bad file path !"});
            node.error("Invalid config JSON file path ", configObj);
            configObj = null;
          }
        } else {
          // オブジェクトがプロパティで設定されている場合、プロパティを読み込んでオブジェクトを生成
          var AnENode = (RED.nodes.getNode(config.AnE));
          AnEObjects = [{options:{}, ObjectContent:{}}];
          AnEObjects[0].options.storeInterval = config.storeInterval;
          AnEObjects[0].options.storeAsync = config.storeAsync;
          AnEObjects[0].objectName = config.objectName;
          AnEObjects[0].objectKey = config.objectKey;
          AnEObjects[0].objectDescription = config.objectDescription;
          AnEObjects[0].ObjectContent.contentType = AnENode.contentType;
          AnEObjects[0].ObjectContent.contentData = AnENode.AnE;
        }
console.log(AnEObjects);
        if (AnEObjects) {
            // configObjから通信するPLCデバイス情報を取り出し、ModbusCom Nodeに追加
            var linkObj = {Coil:[], IS:[], IR:[], HR:[]};
            var address = "";
            AnEObjects.forEach(function(objItem, idx) {
              // 定期収集のためのカウンターをセット
              objItem.options.timeCount = objItem.options.storeInterval;
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
            mbCom.addLinkData(linkObj);

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
console.log("定期収集:" + objItem.objectKey);
                  objItem.options.timeCount = objItem.options.storeInterval;
                  iaCloudObjectSend(objItem.objectKey);
                }
              });
            }, (minCycle * 1000));
        }

        PLCModbusAE.prototype.linkDatachangeListener = function (objectKeys) {
console.log("modbusAE:changeLstenerが呼ばれた");
          //登録したlinkObに変化があったら呼ばれる。
          //そのlinkObjを参照するia-cloudオブエクトをstoreする。
          objectKeys.forEach(function(key, idx) {
            iaCloudObjectSend(key);
          });
        }

        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして早出する関数
        var iaCloudObjectSend = function(objectKey) {

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
          contentData = [];

          iaObject.ObjectContent.contentData.forEach(function(dataItem, index) {
              // 対象のデータアイテムのシャローコピーを作成
              var dItem = Object.assign( {}, dataItem);
              var options = dataItem.options;
              delete dItem.options;
              dItem.dataValue.AnEStatus = "";

              var value = linkObj[options.deviceType].find(function(lData){
                return (lData.address == Number(options.source));
              }).value;
              var preValue = linkObj[options.deviceType].find(function(lData){
                return (lData.address == Number(options.source));
              }).preValue;
              value = (value == "1") ? true: false;
              preValue = (preValue == "1") ? true: false;
              if (options.logic == "neg") {
                value = !value;
                preValue = !preValue;
              }
              if (value) {dItem.dataValue.AnEStatus = (preValue)? "on": "set";}
              else {dItem.dataValue.AnEStatus = (!preValue)? "off": "reset";}
            contentData.push(dItem);
          });

          msg.dataObject.ObjectContent.contentData = contentData;
console.log(msg.dataObject);
          node.send(msg);
        }

        this.on("input",function(msg) {
          //何もしない
        });
        this.on("close",function() {
          clearInterval(sendObjectId);
        });
    }

    RED.nodes.registerType("PLC-Modbus-AE",PLCModbusAE);

}
