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
    var moment = require("moment");
    var fs = require("fs");

    function HmiSchneider(config) {

        RED.nodes.createNode(this,config);
        this.dataObjects = [{}];
        this.connected = false;
        this.hmiCom = RED.nodes.getNode(config.HmiSchneiderCom);
        
        // Nodeステータスを、preparingにする。
        this.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        if (config.confsel == "fileSet"){
          // 設定ファイルの場合、ファイルを読み込んで、オブジェクトに展開
          try{
            this.dataObjects = JSON.parse(fs.readFileSync(config.configfile,'utf8'))
              .dataObjects;
          } catch(e) {
            //エラーの場合は、nodeステータスを変更。
            this.status({fill:"red", shape:"ring", text:"runtime.badFilePath"});
            this.error(RED._("runtime.badFilePath"), config.configfile);
            this.dataObjects = null;
          }
        } else if(config.confsel == "propertySet") {
          // オブジェクトがプロパティで設定されている場合、プロパティを読み込んでオブジェクトを生成
          let dItemsNode = (RED.nodes.getNode(config.dItems));
          this.dataObjects = [{ObjectContent:{}}];
          this.dataObjects[0].storeInterval = config.storeInterval;
          if (config.storeInterval < 1) { this.dataObjects[0].storeInterval = 1;}  //  min 1 sec
          this.dataObjects[0].objectName = config.objectName;
          this.dataObjects[0].objectKey = config.objectKey;
          this.dataObjects[0].objectDescription = config.objectDescription;
          this.dataObjects[0].ObjectContent.contentType = dItemsNode.contentType;
          this.dataObjects[0].ObjectContent.contentData = [];
          for (let i = 0, len = dItemsNode.dItems.length; i < len; i++) {
            this.dataObjects[0].ObjectContent.contentData.push(Object.assign( {}, dItemsNode.dItems[i]));
          }
        }

        // configObjから通信する変数情報を取り出し、HmiSchneiderCom Nodeに追加
        if (this.dataObjects) {
          let linkObj = {Items:[]};
          linkObj.nodeId = this.id;
          linkObj.kind = "variable";
          for (let i=0; i<this.dataObjects.length; i++) {
            this.dataObjects[i].lastCheck = null;

            this.dataObjects[i].ObjectContent.contentData.forEach(function(dataItem, index) {
              linkObj.Items.push(dataItem.variableName);
              dataItem.value = null;
              dataItem.prev = null;
            });
          }
          //HmiSchneiderCom nodeのデータ追加メソッドを呼ぶ
          this.hmiCom.emit("addLinkData", linkObj);

          // Nodeステータスを変更
          this.setWebSocketStatus = function() {
            if (this.connected)
              this.status({fill:"green", shape:"dot", text:"runtime.connected"});
            else
              this.status({fill:"red", shape:"dot", text:"runtime.disconnected"});
          };
          this.setWebSocketStatus();
        }
        
        this.on("valueUpdated",function(variables) {
          for (let j=0; j<this.dataObjects.length; j++) {
            this.dataObjects[j].ObjectContent.contentData.forEach(function(dataItem, index) {
              for (let i=0; i<variables.length; i++){
                if (dataItem.variableName == variables[i].name) {
                  let value = (variables[i].quality != "good") ? null : variables[i].value;
                  if (dataItem.value != value) {
                    this.log("valueUpdated "+variables[i].name+ "/" +  variables[i].quality + "/" + variables[i].value);
                  }
                  dataItem.value = value;
                  break;
                }
              }
            });
          }
        });
        
        this.on("alarmUpdated",function(alarms) {
        });
        
        this.on("statusChanged",function(connected) {
          this.connected = connected;
          this.setWebSocketStatus();
        });

        this.haveVarsUpdated = function(items) {
          for (let i=0; i<items.length; i++) {
            if (items[i].value != items[i].prev) {
              return true;
            }
          }
          return false;
        };

        this.IntervalFunc = function() {
          let current = Date.now();
          
          for (let j=0; j<this.dataObjects.length; j++) {

            if ((this.dataObjects[j].lastCheck != null) &&
                (current - (this.dataObjects[j].lastCheck) < (this.dataObjects[j].storeInterval*1000))) {
              continue;
            }
            this.dataObjects[j].lastCheck = current;

            let items = this.dataObjects[j].ObjectContent.contentData;

            if (this.haveVarsUpdated(items) == false){
              return;
            }

            let dataItems = [];
            for (let i=0; i<items.length; i++) {
              items[i].prev = items[i].value;

              let item = {};
              item.name = items[i].dataName;
              item.value = items[i].value;
              item.unit = items[i].unit;
              dataItems.push(item);
            }
            
            this.iaCloudObjectSend(this.dataObjects[j], dataItems);
          }
        };

        this.sendObjectId = setInterval(this.IntervalFunc.bind(this), (1000));

        this.iaCloudObjectSend = function(iaObject, dataItems) {

          this.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

          let msg = {request:"store", dataObject:{ObjectContent:{}}};
          let contentData = [];

          msg.dataObject.objectKey = iaObject.objectKey;
          msg.dataObject.timeStamp = moment().format();
          msg.dataObject.objectType = "iaCloudObject";
          msg.dataObject.objectDescription = iaObject.objectDescription;
          msg.dataObject.ObjectContent.contentType = iaObject.ObjectContent.contentType;

          for (let i=0; i<dataItems.length; i++) {
            let dItem = {};

            dItem.dataName = dataItems[i].name;
            dItem.dataValue = dataItems[i].value;
            if ((dataItems[i].unit != null) && (dataItems[i].unit != "")) {
              dItem.unit = dataItems[i].unit;
            }

            contentData.push(dItem);
          }

          msg.dataObject.ObjectContent.contentData = contentData;
          
          this.log("send message to iaCloud node : " + JSON.stringify(msg));
          this.send(msg);
          this.status({fill:"blue", shape:"dot", text:"runtime.sent"});

          this.setWebSocketStatus();
        }

        this.on("input",function(msg) {
          //何もしない
        });

        this.on("close",function() {
          clearInterval(this.sendObjectId);
          this.hmiCom.emit("delinkData", this.id);
        });
    }

    RED.nodes.registerType("HMI-Schneider",HmiSchneider);

}
