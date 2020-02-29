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

    function PLCModbus(config) {

        RED.nodes.createNode(this,config);
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
            var address = "";
            dataObjects.forEach(function(objItem, idx) {
              var objectKey = objItem.objectKey;
              var nodeId = (objItem.options.storeAsync)? node.id: "";
              // 定期収集のためのカウンターをセット
              objItem.options.timeCount = objItem.options.storeInterval;

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
                      if (options.deviceType == "Coil") linkObj.Coil.push(linkData);
                      else if (options.deviceType == "IS") linkObj.IS.push(linkData);
                    }
                    break;
                  case "number":
                    var linkData = {address: "", value: "", preValue: ""
                        , nodeId: null, objectKey: ""};
                    linkData.address = options.source;
                    linkData.nodeId = nodeId;
                    linkData.objectKey = objectKey;
                    if (options.deviceType == "IR") linkObj.IR.push(linkData);
                    else if (options.deviceType == "HR") linkObj.HR.push(linkData);

                    if (options.type == "2w-b" || options.type == "2w-l") {
                      var linkData = {address: "", value: "", preValue: ""
                          , nodeId: null, objectKey: ""};
                      linkData.address = Number(options.source) + 1;
                      linkData.nodeId = nodeId;
                      linkData.objectKey = objectKey;
                      if (options.deviceType == "IR") linkObj.IR.push(linkData);
                      else if (options.deviceType == "HR") linkObj.HR.push(linkData);
                    }
                    break;
                  case "string":
                    for (var i = 0, l = options.number; i < l; i++) {
                      var linkData = {address: "", value: "", preValue: ""
                          , nodeId: null, objectKey: ""};
                      linkData.address = Number(options.source) + i;
                      linkData.nodeId = nodeId;
                      linkData.objectKey = objectKey;
                      if (options.deviceType == "IR") linkObj.IR.push(linkData);
                      else if (options.deviceType == "HR") linkObj.HR.push(linkData);
                    }
                    break;
                  case "numList":
                    var wd = (options.type == "1w") ? 1: 2;
                    for (var i = 0, l = options.number * wd; i < l; i++) {
                      var linkData = {address: "", value: "", preValue: ""
                          , nodeId: null, objectKey: ""};
                      linkData.address = Number(options.source) + i;
                      linkData.nodeId = nodeId;
                      linkData.objectKey = objectKey;
                      if (options.deviceType == "IR") linkObj.IR.push(linkData);
                      else if (options.deviceType == "HR") linkObj.HR.push(linkData);
                    }
                    break;
                  default:
                  }
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

        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして早出する関数
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
            var options = dataItem.options;
            delete dItem.options;
            switch(options.itemType) {
              case "bit":
                var value = false;
                dItem.dataValue = [];
                for (var i = 0, l = options.number; i < l; i++) {
                  var value = linkObj[options.deviceType].find(function(lData){
                    return (lData.address == Number(options.source) + i);
                  }).value;
                  value = (value != "0") ? true: false;
                  if (options.logic == "neg") value = !value;
                  dItem.dataValue.push(value);
                }
                break;
              case "number":
                var value = "", uValue = "", lValue = "";
                dItem.dataValue = 0;
                if (options.type == "1w") {
                  value = linkObj[options.deviceType]
                      .find(function(lData){
                        return (lData.address == Number(options.source));
                      }).value.slice(-4);
                } else {
                  uValue = linkObj[options.deviceType].find(function(lData){
                    return (lData.address == Number(options.source));
                  }).value.slice(-4);
                  lValue = linkObj[options.deviceType].find(function(lData){
                    return (lData.address == Number(options.source) + 1);
                  }).value.slice(-4);
                  if (options.type == "2w-b") value = uValue + lValue;
                  if (options.type == "2w-l") value = lValue + uValue;
                }
                if (options.encode == "signed") dItem.dataValue = -1 - ~parseInt(value, 16);
                if (options.encode == "unsigned") dItem.dataValue = parseInt("0" + value, 16);
                if (options.encode == "BCD") dItem.dataValue = parseInt(value, 10);
                dItem.dataValue = dItem.dataValue * options.gain + Number(options.offset);
                break;
              case "string":
                var value = "";
                dItem.dataValue = "";
                for (var i = 0, l = options.number; i < l; i++) {
                  value = value + linkObj[options.deviceType]
                      .find(function(lData){
                        return (lData.address == Number(options.source) + i);
                      }).value.slice(-4);
                }
                if (options.encode == "utf-8") {
                  dItem.dataValue = Buffer.from(value, "hex").toString("utf-8");
                }
                else if (options.encode == "sJIS") {
                  dItem.dataValue = iconv.decode(Buffer.from(value, "hex"), "shiftjis");
                }
                else if (options.encode == "EUC") {
                  dItem.dataValue = iconv.decode(Buffer.from(value, "hex"), "eucjp");
                }
                break;

              case "numList":
                dItem.dataValue = [];
                for (var i = 0, l = options.number; i < l; i++) {
                  if (options.type == "1w") {
                    value = linkObj[options.deviceType]
                        .find(function(lData){
                          return (lData.address == Number(options.source) + i);
                        }).value.slice(-4);
                  } else {
                    uValue = linkObj[options.deviceType].find(function(lData){
                        return (lData.address == Number(options.source) + 2 * i);
                    }).value.slice(-4);
                    lValue = linkObj[options.deviceType].find(function(lData){
                        return (lData.address == Number(options.source) + 2 * i + 1);
                    }).value.slice(-4);
                    if (options.type == "2w-b") value = uValue + lValue;
                    if (options.type == "2w-l") value = lValue + uValue;
                  }
                  if (options.encode == "signed") dItem.dataValue.push(-1 - ~parseInt(value, 16));
                  if (options.encode == "unsigned") dItem.dataValue.push(parseInt("0" + value, 16));
                  if (options.encode == "BCD") dItem.dataValue.push(parseInt(value, 10));
                }
                break;
              default:
              }
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

    RED.nodes.registerType("PLC-Modbus",PLCModbus);

}
