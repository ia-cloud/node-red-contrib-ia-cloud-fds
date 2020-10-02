
module.exports = function (RED) {
  "use strict";
  var moment = require("moment");
  var fs = require("fs");

  function HmiSchneider(config) {

    RED.nodes.createNode(this, config);
    this.dataObjects = [{}];
    this.hmiCom = RED.nodes.getNode(config.HmiSchneiderCom);

    // Nodeステータスを、preparingにする。
    this.status({ fill: "blue", shape: "ring", text: "runtime.preparing" });

    // プロパティを読み込んでオブジェクトを生成
    this.dataObjects = [{ ObjectContent: {} }];
    this.dataObjects[0].asyncInterval = config.storeAsync ? 1 : 0;
    this.dataObjects[0].storeInterval = config.storeInterval;
    this.dataObjects[0].objectKey = config.objectKey;
    this.dataObjects[0].objectDescription = config.objectDescription;
    this.dataObjects[0].ObjectContent.contentType = config.contentType;
    this.dataObjects[0].ObjectContent.contentData = [];
    config.dataItems.forEach(function (item) {
      this.dataObjects[0].ObjectContent.contentData.push(Object.assign({}, item));
    }, this);

    // configObjから通信する変数情報を取り出し、HmiSchneiderCom Nodeに追加
    let linkObj = { Items: [] };
    linkObj.nodeId = this.id;
    linkObj.kind = "variable";

    this.dataObjects.forEach(function (obj) {
      obj.lastIntervalCheck = null;
      obj.lastValueChangedCheck = null;
      obj.ObjectContent.contentData.forEach(function (dataItem) {
        linkObj.Items.push(dataItem.varName);
        dataItem.value = null;
        dataItem.prev = null;
      });
    });

    //HmiSchneiderCom nodeのデータ追加メソッドを呼ぶ
    this.hmiCom.emit("addLinkData", linkObj);

    // Nodeステータスを変更
    this.setWebSocketStatus = function () {
      if (this.hmiCom.flagOpened) {
        this.status({ fill: "green", shape: "dot", text: "runtime.connected" });
      }
      else {
        this.status({ fill: "red", shape: "dot", text: "runtime.disconnected" });
      }
    };
    this.setWebSocketStatus();

    this.on("valueUpdated", function (variables) {
      this.dataObjects.forEach(function (obj) {
        obj.ObjectContent.contentData.forEach(function (dataItem) {
          for (let i = 0; i < variables.length; i++) {
            if (dataItem.varName == variables[i].name) {
              let value = (variables[i].quality != "good") ? null : variables[i].value;
              dataItem.value = value;
              break;
            }
          }
        });
      });
    });

    this.on("alarmUpdated", function (alarms) {
    });

    this.on("statusChanged", function (connected) {
      if (!connected) {
        //  HMIの接続が切れた場合はエラーとする
        this.error("HMI is not connected.");
      }
      this.setWebSocketStatus();
    });

    this.haveVarsUpdated = function (items) {
      if (!this.hmiCom.flagOpened) {
        return false;
      }
      return (items.find(item => item.value != item.prev) != undefined) ? true : false;
    };

    this.IntervalFunc = function () {
      let current = Date.now();

      this.dataObjects.forEach(function (obj) {
        //  check interval
        if (obj.storeInterval > 0) {
          if ((obj.lastIntervalCheck == null) || (current - (obj.lastIntervalCheck) >= (obj.storeInterval * 1000))) {
            this.iaCloudObjectSend(obj, (obj.lastIntervalCheck == null)); //  初回だけ変化通知のフラグをONする
            obj.lastIntervalCheck = current;
          }
        }
      }, this);

      this.dataObjects.forEach(function (obj) {
        //  check async
        if (obj.asyncInterval > 0) {
          if ((obj.lastValueChangedCheck == null) || (current - (obj.lastValueChangedCheck) >= (obj.asyncInterval * 1000))) {
            obj.lastValueChangedCheck = current;
            if (this.haveVarsUpdated(obj.ObjectContent.contentData) == false) {
              return;
            }

            this.iaCloudObjectSend(obj, true);
          }
        }
      }, this);
    };

    this.sendObjectId = setInterval(this.IntervalFunc.bind(this), (1000));

    this.iaCloudObjectSend = function (iaObject, valuechanged) {
      if (!this.hmiCom.flagOpened) {
        //  HMIが接続されていない場合は何もしない
        return false;
      }

      this.status({ fill: "blue", shape: "ring", text: "runtime.preparing" });

      let msg = { request: "store", dataObject: { ObjectContent: {} } };
      let contentData = [];

      msg.dataObject.objectKey = iaObject.objectKey;
      msg.dataObject.timeStamp = moment().format();
      msg.dataObject.objectType = "iaCloudObject";
      msg.dataObject.objectDescription = iaObject.objectDescription;
      msg.dataObject.ObjectContent.contentType = iaObject.ObjectContent.contentType;

      iaObject.ObjectContent.contentData.forEach(function (item) {
        //  update previous value when value changed trigger
        if (valuechanged) { item.prev = item.value; }

        let dItem = {};
        dItem.dataName = item.dataName;
        dItem.dataValue = item.value;
        if ((item.unit != null) && (item.unit != "")) {
          dItem.unit = item.unit;
        }
        contentData.push(dItem);
      });

      msg.dataObject.ObjectContent.contentData = contentData;
      msg.payload = contentData;

      this.send(msg);
      this.status({ fill: "blue", shape: "dot", text: "runtime.sent" });

      this.setWebSocketStatus();
      return true;
    }

    this.on("input", function (msg) {
      if (!this.hmiCom.flagOpened) {
        //  HMIの接続されていない場合はエラーとする
        this.error("HMI is not connected.", msg);
        return;
      }

      this.dataObjects.forEach(function (obj) {
        this.iaCloudObjectSend(obj, false);
      }, this);
    });

    this.on("close", function () {
      clearInterval(this.sendObjectId);
      this.hmiCom.emit("delLinkData", this.id);
    });
  }

  RED.nodes.registerType("HMI-Schneider", HmiSchneider);

}
