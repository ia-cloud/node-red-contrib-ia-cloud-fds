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

    function PLCModbus(config) {

        RED.nodes.createNode(this,config);

        var node = this;
        var dataObjects = [{}];
        var storeObj;
        var mbCom = RED.nodes.getNode(config.ModbusCom);
        if (config.confsel == "fileSet"){
          // 設定ファイルの場合、ファイルを読み込んで、オブジェクトに展開
          try{
            dataObjects = JSON.parse(fs.readFileSync(config.configfile,'utf8'))
              .dataObjects;
          } catch(e) {
            //エラーの場合は、nodeステータスを変更。
            node.status({fill:"red",shape:"ring",text:"bad file path !"});
            node.error("Invalid config JSON file path ", configObj);
            dataObjects = null;
          }
        } else if(config.confsel == "propertySet") {
          // オブジェクトがプロパティで設定されている場合、プロパティを読み込んでオブジェクトを生成
          var dItemsNode = (RED.nodes.getNode(config.dItems));
          dataObjects = [{options:{}, ObjectContent:{}}]
          dataObjects[0].options.storeInterval = config.storeInterval;
          dataObjects[0].options.storeAsync = config.storeAsync;
          dataObjects[0].objectName = config.objectName;
          dataObjects[0].objectKey = config.objectKey;
          dataObjects[0].objectDescription = config.objectDescription;
          dataObjects[0].ObjectContent.contentType = dItemsNode.contentType;
          dataObjects[0].ObjectContent.contentData = dItemsNode.dItems;
        }
        // configObjから通信するPLCデバイス情報を取り出し、ModbusCom Nodeに追加
        if (dataObjects) {
            var linkObj = {coil:[], inputStatus:[], inputRegister:[], holdingRegister:[]};
            var address = "";
            dataObjects.forEach(function(objItem, idx) {
              var objectKey = objItem.objectKey;
              var nodeId = (objItem.options.storeAsync)? node.id: "";
              objItem.ObjectContent.contentData.forEach(function(dataItem, index) {
                var options = dataItem.options;
                switch(options.itemType) {
                  case "bit":
                    for (var i = 0, l = options.number; i < l; i++) {
                      var linkData = {address: 0, value: "", preValue: ""
                          , nodeId: null, objectKey: ""};
                      linkData.address =  Number(options.source) + i;
                      linkData.nodeId = nodeId;
                      linkData.objectKey = objectKey;
                      if (options.deviceType == "Coil") linkObj.coil.push(linkData);
                      else if (options.deviceType == "IS") linkObj.inputStatus.push(linkData);
                    }
                    break;
                  case "number":
                    var linkData = {address: "", value: "", preValue: ""
                        , nodeId: null, objectKey: ""};
                    linkData.address = options.source;
                    linkData.nodeId = nodeId;
                    linkData.objectKey = objectKey;
                    if (options.deviceType == "IR") linkObj.inputRegister.push(linkData);
                    else if (options.deviceType == "HR") linkObj.holdingRegister.push(linkData);

                    if (options.type == "dWord" || options.type == "dBCD") {
                      var linkData = {address: "", value: "", preValue: ""
                          , nodeId: null, objectKey: ""};
                      linkData.address = options.source + 1;
                      linkData.nodeId = nodeId;
                      linkData.objectKey = objectKey;
                      if (options.deviceType == "IR") linkObj.inputRegister.push(linkData);
                      else if (options.deviceType == "HR") linkObj.holdingRegister.push(linkData);
                    }
                    break;
                  case "string":
                    for (var i = 0, l = options.number; i < l; i++) {
                      var linkData = {address: "", value: "", preValue: ""
                          , nodeId: null, objectKey: ""};
                      linkData.address = Number(options.source) + i;
                      linkData.nodeId = nodeId;
                      linkData.objectKey = objectKey;
                      if (options.deviceType == "IR") linkObj.inputRegister.push(linkData);
                      else if (options.deviceType == "HR") linkObj.holdingRegister.push(linkData);
                    }
                    break;
                  case "numList":
                    var wd;
                    if (options.type == "dWord" || options.type == "dBCD") wd = 2;
                    else wd = 1
                    for (var i = 0, l = options.number * wd; i < l; i++) {
                      var linkData = {address: "", value: "", preValue: ""
                          , nodeId: null, objectKey: ""};
                      linkData.address = Number(options.source) + i;
                      linkData.nodeId = nodeId;
                      linkData.objectKey = objectKey;
                      if (options.deviceType == "IR") linkObj.inputRegister.push(linkData);
                      else if (options.deviceType == "HR") linkObj.holdingRegister.push(linkData);
                    }
                    break;
                  default:
                  }
              });
            });

            //modbusCom nodeのデータ追加メソッドを呼ぶ
            mbCom.addLinkData(linkObj);

            setInterval(function(){
              //設定された格納周期で,ModbusCom Nodeからデータを取得し、ia-cloudオブジェクトを生成、メッセージで送出
              //いろいろな処理
              //複数の周期でオブジェクトの格納をするため、10秒周期でカウントし、カウントアップしたら、オブジェクト生成、メッセージ出力を行う。
              //this.send(storeObj);
            }, 10 * 1000);
        }

        this.on("input",function(msg) {
          //何もしない
        });

        this.on("close",function() {

        });


        PLCModbus.prototype.linkDatachangeListener = function (objectKey) {

console.log("modbus:changeLstenerが呼ばれた");

          //登録したlinkObに変化があったら呼ばれる。
          //そのlinkObjを参照するia-cloudオブエクトをstoreする。

        }
    }

    RED.nodes.registerType("PLC-Modbus",PLCModbus);

}
