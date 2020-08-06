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

module.exports = function (RED) {
  "use strict";
  var moment = require("moment");
  var fs = require("fs");

  function hmiSchneiderAE(config) {

    RED.nodes.createNode(this, config);

    this.AnEObject = {};
    this.connected = false;
    this.hmiCom = RED.nodes.getNode(config.HmiSchneiderCom);

    // Nodeステータスを、preparingにする。
    this.status({ fill: "blue", shape: "ring", text: "runtime.preparing" });

    // プロパティを読み込んでオブジェクトを生成
    this.AnEObject = { ObjectContent: {} };
    this.AnEObject.storeInterval = config.storeInterval;
    this.AnEObject.objectName = config.objectName;
    this.AnEObject.objectKey = config.objectKey;
    this.AnEObject.objectDescription = config.objectDescription;
    this.AnEObject.ObjectContent.contentData = [];
    for (let i = 0, len = config.aeItems.length; i < len; i++) {
      this.AnEObject.ObjectContent.contentData.push(Object.assign({}, config.aeItems[i]));
    }

    let linkObj = {};
    linkObj.nodeId = this.id;
    linkObj.kind = "alarm";

    this.AnEObject.lastCheck = null;

    this.AnEObject.ObjectContent.contentData.forEach(function (dataItem, index) {
      dataItem.status = null;
      dataItem.prev = null;
      dataItem.message = "";
    });

    //HmiSchneiderCom nodeのデータ追加メソッドを呼ぶ
    this.hmiCom.emit("addLinkData", linkObj);

    // Nodeステータスを変更
    this.setWebSocketStatus = function () {
      if (this.connected)
        this.status({ fill: "green", shape: "dot", text: "runtime.connected" });
      else
        this.status({ fill: "red", shape: "dot", text: "runtime.disconnected" });
    };
    this.setWebSocketStatus();

    this.on("valueUpdated", function (variables) {
    });

    this.on("alarmUpdated", function (alarms) {
      this.AnEObject.ObjectContent.contentData.forEach(function (dataItem, index) {
        for (let i = 0; i < alarms.length; i++) {
          if (dataItem.varName == alarms[i].variable) {
            let status = null;
            if (alarms[i].status == "Return") {
              status = null;
            } else {
              status = alarms[i].type;
            }
            //if (dataItem.status != status) {
            //  this.log("alarmUpdated "+alarms[i].variable+ "/" +  alarms[i].status);
            //}
            dataItem.status = status;
            dataItem.message = alarms[i].message;
            break;
          }
        }
      });

    });

    this.on("statusChanged", function (connected) {
      this.connected = connected;
      this.setWebSocketStatus();
    });

    this.haveAlarmsUpdated = function (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].status != items[i].prev) {
          return true;
        }
      }
      return false;
    };


    this.IntervalFunc = function () {
      let current = Date.now();

      if ((this.AnEObject.lastCheck != null) &&
        (current - (this.AnEObject.lastCheck) < (this.AnEObject.storeInterval * 1000))) {
        return;
      }
      this.AnEObject.lastCheck = current;

      let items = this.AnEObject.ObjectContent.contentData;

      if ((this.haveAlarmsUpdated(items) == false) /*&& (this.connected == false)*/) {
        return;
      }

      let dataItems = [];
      for (let i = 0; i < items.length; i++) {

        let item = {};
        let status = "";
        if (items[i].status == null) {
          status = (items[i].status == items[i].prev) ? "off" : "reset";
        } else {
          status = (items[i].status == items[i].prev) ? "on" : "set";
        }
        item.AnEStatus = status;
        item.AnECode = items[i].code;
        if (!item.AnECode) { item.AnECode = items[i].varName; }
        item.AnEDescription = items[i].description;
        if (!item.AnEDescription) { item.AnEDescription = items[i].message; }
        dataItems.push(item);

        items[i].prev = items[i].status;
      }

      this.iaCloudObjectSend(this.AnEObject, dataItems);
    };

    this.sendObjectId = setInterval(this.IntervalFunc.bind(this), (1000));


    // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして早出する関数
    this.iaCloudObjectSend = function (iaObject, dataItems) {

      this.status({ fill: "blue", shape: "ring", text: "runtime.preparing" });

      let msg = { request: "store", dataObject: { ObjectContent: {} } };
      let contentData = [];

      msg.dataObject.objectKey = iaObject.objectKey;
      msg.dataObject.timeStamp = moment().format();
      msg.dataObject.objectType = "iaCloudObject";
      msg.dataObject.objectDescription = iaObject.objectDescription;
      msg.dataObject.ObjectContent.contentType = "Alarm&Event";

      for (let i = 0; i < dataItems.length; i++) {
        let dItem = {};

        dItem.AnEStatus = dataItems[i].AnEStatus;
        dItem.AnECode = dataItems[i].AnECode;
        dItem.AnEDescription = dataItems[i].AnEDescription;

        contentData.push(dItem);
      }

      msg.dataObject.ObjectContent.contentData = contentData;
      msg.payload = contentData;

      //this.log("send message to iaCloud node : " + JSON.stringify(msg));
      this.send(msg);
      this.status({ fill: "green", shape: "dot", text: "runtime.sent" });

      this.setWebSocketStatus();
    }

    this.on("input", function (msg) {
      //何もしない
    });
    this.on("close", function () {
      clearInterval(this.sendObjectId);
      this.hmiCom.emit("delinkData", this.id);
    });
  }

  RED.nodes.registerType("HMI-Schneider-AE", hmiSchneiderAE);

}
