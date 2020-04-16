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
    const iconv = require("iconv-lite");
    let intervalId;

    function PLCModbus(config) {

        RED.nodes.createNode(this,config);
        const node = this;

        // Nodeのconfigパラメータから、dataItemオブジェクトを生成
        let dataItems = config.dataItems;

        //Nodeのconfigパラメータから、iaCloudオブジェクトを生成
        let modbusObject= {
            objectKey: config.objectKey,
            objectType: "iaCloudObject",
            objectDescription: config.objectDescription,
            objectContent: {
                contentType: config.contentType,
                contentData: [{}]
            }
        };
 
        var mbCom = RED.nodes.getNode(config.ModbusCom);
        var minCycle = 10; // 最小収集周期を10秒に設定

        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        // configObjから通信するPLCデバイス情報を取り出し、ModbusCom Nodeに追加
        if (modbusObject) {
            var linkObj = {Coil:[], IS:[], IR:[], HR:[]};

            // 非同期収集ありの場合、自身のNodeIDをセット。
            var nodeId = (config.storeAsync)? node.id: "";
            // 定期収集のためのカウンターをセット
            let timeCount = config.storeInterval;
            let options;
            dataItems.forEach(function(dataItem) {
              switch(dataItem.itemType) {
                case "bit":
                  options = dataItem.bit;
                  for (var i = 0, l = options.number; i < l; i++) {
                    var linkData = {address: 0, value: "", preValue: ""
                        , nodeId: null, objectKey: ""};
                    linkData.address =  Number(options.address) + i;
                    linkData.nodeId = nodeId;
                    linkData.objectKey = config.objectKey;
                    if (options.deviceType == "Coil") linkObj.Coil.push(linkData);
                    else if (options.deviceType == "IS") linkObj.IS.push(linkData);
                  }
                  break;
                case "number":
                  options = dataItem.number;
                  var linkData = {address: "", value: "", preValue: ""
                      , nodeId: null, objectKey: ""};
                  linkData.address = options.address;
                  linkData.nodeId = nodeId;
                  linkData.objectKey = config.objectKey;
                  if (options.deviceType == "IR") linkObj.IR.push(linkData);
                  else if (options.deviceType == "HR") linkObj.HR.push(linkData);

                  if (options.type == "2w-b" || options.type == "2w-l") {
                    var linkData = {address: "", value: "", preValue: ""
                        , nodeId: null, objectKey: ""};
                    linkData.address = Number(options.address) + 1;
                    linkData.nodeId = nodeId;
                    linkData.objectKey = config.objectKey;
                    if (options.deviceType == "IR") linkObj.IR.push(linkData);
                    else if (options.deviceType == "HR") linkObj.HR.push(linkData);
                  }
                  break;
                case "string":
                  options = dataItem.string;
                  for (var i = 0, l = options.number; i < l; i++) {
                    var linkData = {address: "", value: "", preValue: ""
                        , nodeId: null, objectKey: ""};
                    linkData.address = Number(options.address) + i;
                    linkData.nodeId = nodeId;
                    linkData.objectKey = config.objectKey;
                    if (options.deviceType == "IR") linkObj.IR.push(linkData);
                    else if (options.deviceType == "HR") linkObj.HR.push(linkData);
                  }
                  break;
                case "numList":
                  options = dataItem.numList;
                  var wd = (options.type == "1w") ? 1: 2;
                  for (var i = 0, l = options.number * wd; i < l; i++) {
                    var linkData = {address: "", value: "", preValue: ""
                        , nodeId: null, objectKey: ""};
                    linkData.address = Number(options.address) + i;
                    linkData.nodeId = nodeId;
                    linkData.objectKey = config.objectKey;
                    if (options.deviceType == "IR") linkObj.IR.push(linkData);
                    else if (options.deviceType == "HR") linkObj.HR.push(linkData);
                  }
                  break;
                  default:
                }
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
                  timeCount = timeCount - minCycle;
                  if (timeCount > 0) return;
                  // 収集周期がきた。収集周期を再設定。
                  timeCount = config.storeInterval;
                  iaCloudObjectSend(config.objectKey);
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
        var iaCloudObjectSend = function(objectKey) {

            // 自身のobjectKeyでなかった、ら何もしない。
            if(!objectKey == config.objectKey) return;

            node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

            var msg = {request:"store", dataObject:{objectContent:{}}};
            var contentData = [];

            msg.dataObject.objectKey = config.objectKey;
            msg.dataObject.timeStamp = moment().format();
            msg.dataObject.objectType = "iaCloudObject";
            msg.dataObject.objectDescription = config.objectDescription;
            msg.dataObject.objectContent.contentType = config.contentType;

            dataItems.forEach(function(dataItem) {
                // 対象のデータアイテムを作成
                let dItem = {
                    dataName: dataItem.dataName,
                    dataValue: null,
                };
                let options;
                let value, uValue, lValue;
                switch(dataItem.itemType) {

                    case "bit":
                    options = dataItem.bit;
                    if (options.number == 1) {
                        value = linkObj[options.deviceType].find(function(lData){
                          return (lData.address == Number(options.address));
                        }).value;
                        value = (value != "0") ? true: false;
                        if (options.logic == "neg") value = !value;
                        dItem.dataValue = value;
                    };
                    if (options.number > 1) {
                        dItem.dataValue = [];
                        for (var i = 0, l = options.number; i < l; i++) {
                            value = linkObj[options.deviceType].find(function(lData){
                              return (lData.address == Number(options.address) + i);
                            }).value;
                            value = (value != "0") ? true: false;
                            if (options.logic == "neg") value = !value;
                            dItem.dataValue.push(value);
                        };
                    };
                    break;

                    case "number":
                    options = dataItem.number;
                    dItem.dataValue = 0;
                    if (options.type == "1w") {
                        value = linkObj[options.deviceType]
                            .find(function(lData){
                                return (lData.address == Number(options.address));
                            }).value.slice(-4);
                    } else {
                        uValue = linkObj[options.deviceType].find(function(lData){
                            return (lData.address == Number(options.address));
                        }).value.slice(-4);
                        lValue = linkObj[options.deviceType].find(function(lData){
                            return (lData.address == Number(options.address) + 1);
                        }).value.slice(-4);
                        if (options.type == "2w-b") value = uValue + lValue;
                        if (options.type == "2w-l") value = lValue + uValue;
                    }
                    if (options.encode == "signed") dItem.dataValue = -1 - ~parseInt(value, 16);
                    if (options.encode == "unsigned") dItem.dataValue = parseInt("0" + value, 16);
                    if (options.encode == "BCD") dItem.dataValue = parseInt(value, 10);
                    dItem.dataValue = dItem.dataValue * options.gain + Number(options.offset);
                    if(dataItem.unit) ditem[umit] = dataItem.unit;
                    break;

                    case "string":                 
                    options = dataItem.string;
                    dItem.dataValue = "";
                    for (var i = 0, l = options.number; i < l; i++) {
                        value = value + linkObj[options.deviceType]
                            .find(function(lData){
                              return (lData.address == Number(options.address) + i);
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
                    options = dataItem.numList;
                    dItem.dataValue = [];
                    for (var i = 0, l = options.number; i < l; i++) {
                        if (options.type == "1w") {
                            value = linkObj[options.deviceType]
                            .find(function(lData){
                              return (lData.address == Number(options.address) + i);
                            }).value.slice(-4);
                        } else {
                          uValue = linkObj[options.deviceType].find(function(lData){
                              return (lData.address == Number(options.address) + 2 * i);
                          }).value.slice(-4);
                          lValue = linkObj[options.deviceType].find(function(lData){
                              return (lData.address == Number(options.address) + 2 * i + 1);
                          }).value.slice(-4);
                          if (options.type == "2wb") value = uValue + lValue;
                          if (options.type == "2wl") value = lValue + uValue;
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
            msg.dataObject.objectContent.contentData = contentData;
            msg.payload = RED._("runtime.sent");
            node.send(msg);
            node.status({fill:"green", shape:"dot", text:"runtime.sent"});
        }
        this.on("input",function(msg) {
            if (msg.payload) iaCloudObjectSend(config.objectKey);
        });
        this.on("close",function() {
            clearInterval(intervalId);
        });
    }

    RED.nodes.registerType("PLC-Modbus",PLCModbus);

}
