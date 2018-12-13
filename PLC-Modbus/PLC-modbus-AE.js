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
        var AandEObjects = [{}];
        var storeObj;
console.log("Hi");
        var mbCom = (RED.nodes.getNode(config.ModbusCom));
        if (config.confsel == "fileSet"){
          // 設定ファイルの場合、ファイルを読み込んで、オブジェクトに展開
          try{
            AandEObjects = JSON.parse(fs.readFileSync(config.configfile,'utf8'))
              .AandEObjects;
          } catch(e) {
            //エラーの場合は、nodeステータスを変更。
            node.status({fill:"red",shape:"ring",text:"bad file path !"});
            node.error("Invalid config JSON file path ", configObj);
            configObj = null;
          }
        } else {
          // オブジェクトがプロパティで設定されている場合、プロパティを読み込んでオブジェクトを生成
          var AandENode = (RED.nodes.getNode(config.AandE));
          AandEObjects = [{ObjectContent:{}}];
          AandEObjects[0].objectName = config.objectName;
          AandEObjects[0].objectKey = config.objectKey;
          AandEObjects[0].objectDescription = config.objectDescription;
          AandEObjects[0].ObjectContent.contentType = AandENode.contentType;
          AandEObjects[0].ObjectContent.contentData = AandENode.AandE;
        }
        if (AandEObjects) {
            // configObjから通信するPLCデバイス情報を取り出し、ModbusCom Nodeに追加
            var linkObj = {Coil:[], IS:[], IR:[], HR:[]};
            var address = "";
            AandEObjects.forEach(function(objItem, idx) {

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
        }

        this.on("input",function(msg) {
          //何もしない
        });
        this.on("close",function() {
          //何もしない
        });

        PLCModbusAE.prototype.linkDatachangeListener = function (objectKey) {

console.log("modbusAE:changeLstenerが呼ばれた");

          //登録したlinkObに変化があったら呼ばれる。
          //そのlinkObjを参照するia-cloudオブエクトをstoreする。

        }
    }

    RED.nodes.registerType("PLC-Modbus-AE",PLCModbusAE);

}
