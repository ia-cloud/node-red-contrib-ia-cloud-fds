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

    function hmiSchneiderAE(config) {

        RED.nodes.createNode(this,config);

        this.AnEObjects = [{}];
        this.connected = false;
        this.hmiCom = RED.nodes.getNode(config.HmiSchneiderCom);

        // Nodeステータスを、preparingにする。
        this.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        if (config.confsel == "fileSet"){
          // 設定ファイルの場合、ファイルを読み込んで、オブジェクトに展開
          try{
            this.AnEObjects = JSON.parse(fs.readFileSync(config.configfile,'utf8'))
              .AnEObjects;
          } catch(e) {
            //エラーの場合は、nodeステータスを変更。
            this.status({fill:"red",shape:"ring",text:"runtime.badFilePath"});
            this.error(RED._("runtime.badFilePath"), configObj);
            configObj = null;
          }
        } else {
          // オブジェクトがプロパティで設定されている場合、プロパティを読み込んでオブジェクトを生成
          let AnENode = (RED.nodes.getNode(config.AnE));
          this.AnEObjects = [{ObjectContent:{}}];
          this.AnEObjects[0].storeInterval = config.storeInterval;
          this.AnEObjects[0].objectName = config.objectName;
          this.AnEObjects[0].objectKey = config.objectKey;
          this.AnEObjects[0].objectDescription = config.objectDescription;
          this.AnEObjects[0].ObjectContent.contentType = AnENode.contentType;
          this.AnEObjects[0].ObjectContent.contentData = [];
          for (let i = 0, len = AnENode.AnE.length; i < len; i++) {
            this.AnEObjects[0].ObjectContent.contentData.push(Object.assign( {}, AnENode.AnE[i]));
          }
        }

        if (this.AnEObjects) {
          let linkObj = {};
          linkObj.nodeId = this.id;
          linkObj.kind = "alarm";

          for (let i=0; i<this.AnEObjects.length; i++) {
            this.AnEObjects[i].lastCheck = null;

            this.AnEObjects[i].ObjectContent.contentData.forEach(function(dataItem, index) {
              dataItem.status = null;
              dataItem.prev = null;
              dataItem.message = "";
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
        });
        
        this.on("alarmUpdated",function(alarms) {
          for (let j=0; j<this.AnEObjects.length; j++) {
            this.AnEObjects[j].ObjectContent.contentData.forEach(function(dataItem, index) {
              for (let i=0; i<alarms.length; i++){
                if (dataItem.dataValue.VarName == alarms[i].variable) {
                  let status = null;
                  if (alarms[i].status == "Return") {
                    status = null;
                  } else {
                    status = alarms[i].type;
                  }
                  if (dataItem.status != status) {
                    this.log("alarmUpdated "+alarms[i].variable+ "/" +  alarms[i].status);
                  }
                  dataItem.status = status;
                  dataItem.message = alarms[i].message;
                  break;
                }
              }
            });
          }
        });
        
        this.on("statusChanged",function(connected) {
          this.connected = connected;
          this.setWebSocketStatus();
        });

        this.haveAlarmsUpdated = function(items) {
          for (let i=0; i<items.length; i++) {
            if (items[i].status != items[i].prev) {
              return true;
            }
          }
          return false;
        };

        
        this.IntervalFunc = function() {
          let current = Date.now();
          
          for (let j=0; j<this.AnEObjects.length; j++) {

            if ((this.AnEObjects[j].lastCheck != null) &&
                (current - (this.AnEObjects[j].lastCheck) < (this.AnEObjects[j].storeInterval*1000))) {
              continue;
            }
            this.AnEObjects[j].lastCheck = current;

            let items = this.AnEObjects[j].ObjectContent.contentData;

            if ((this.haveAlarmsUpdated(items) == false) /*&& (this.connected == false)*/){
              return;
            }

            let dataItems = [];
            for (let i=0; i<items.length; i++) {

              let item = {};
              let status = "";
              if (items[i].status == null) {
                status = (items[i].status == items[i].prev) ? "off": "reset";
              } else {
                status = (items[i].status == items[i].prev) ? "on": "set";
              }
              item.AnEStatus = status;
              item.AnECode = items[i].dataValue.AnECode;
              if (!item.AnECode) { item.AnECode = items[i].dataValue.VarName; }
              item.AnEDescription = items[i].dataValue.AnEDescription;
              if (!item.AnEDescription) { item.AnEDescription = items[i].message; }
              dataItems.push(item);

              items[i].prev = items[i].status;
            }
            
            this.iaCloudObjectSend(this.AnEObjects[j], dataItems);
          }
        };

        this.sendObjectId = setInterval(this.IntervalFunc.bind(this), (1000));


        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして早出する関数
        this.iaCloudObjectSend = function(iaObject, dataItems) {

          this.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

          let msg = {request: "store", dataObject:{ObjectContent:{}}};
          let contentData = [];

          msg.dataObject.objectKey = iaObject.objectKey;
          msg.dataObject.timeStamp = moment().format();
          msg.dataObject.objectType = "iaCloudObject";
          msg.dataObject.objectDescription = iaObject.objectDescription;
          msg.dataObject.ObjectContent.contentType = "Alarm&Event";

          for (let i=0; i<dataItems.length; i++) {
            let dItem = {};

            dItem.AnEStatus = dataItems[i].AnEStatus;
            dItem.AnECode = dataItems[i].AnECode;
            dItem.AnEDescription = dataItems[i].AnEDescription;
            
            contentData.push(dItem);
          }

          msg.dataObject.ObjectContent.contentData = contentData;

          this.log("send message to iaCloud node : " + JSON.stringify(msg));
          this.send(msg);
          this.status({fill:"green", shape:"dot", text:"runtime.sent"});

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

    RED.nodes.registerType("HMI-Schneider-AE",hmiSchneiderAE);

}
