
module.exports = function (RED) {
  "use strict";
  var moment = require("moment");
  var fs = require("fs");

  function hmiSchneiderAE(config) {

    RED.nodes.createNode(this, config);
    this.AnEObject = {};
    this.hmiCom = RED.nodes.getNode(config.HmiSchneiderCom);

    // Nodeステータスを、preparingにする。
    this.status({ fill: "blue", shape: "ring", text: "runtime.preparing" });

    // プロパティを読み込んでオブジェクトを生成
    this.AnEObject = [{ ObjectContent: {} }];
    this.AnEObject[0].asyncInterval = config.storeAsync ? 1 : 0;
    this.AnEObject[0].storeInterval = config.storeInterval;
    this.AnEObject[0].objectKey = config.objectKey;
    this.AnEObject[0].objectDescription = config.objectDescription;
    this.AnEObject[0].ObjectContent.contentData = [];
    config.aeItems.forEach(function (item) {
      this.AnEObject[0].ObjectContent.contentData.push(Object.assign({}, item));
    }, this);

    let linkObj = {};
    linkObj.nodeId = this.id;
    linkObj.kind = "alarm";

    this.AnEObject.forEach(function (obj) {
      obj.lastIntervalCheck = null;
      obj.lastValueChangedCheck = null;
      obj.ObjectContent.contentData.forEach(function (dataItem) {
        dataItem.status = null;
        dataItem.prev = null;
        dataItem.message = "";
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
    });

    this.on("alarmUpdated", function (alarms) {
      this.AnEObject.forEach(function (obj) {
        obj.ObjectContent.contentData.forEach(function (dataItem, index) {
          for (let i = 0; i < alarms.length; i++) {
            if (dataItem.varName == alarms[i].variable) {
              let status = null;
              if (alarms[i].status == "Return") {
                status = null;
              } else {
                status = alarms[i].type;
              }
              dataItem.status = status;
              dataItem.message = alarms[i].message;
              break;
            }
          }
        });
      });
    });

    this.on("statusChanged", function (connected) {
      if (!connected) {
        //  HMIの接続が切れた場合はエラーとする
        this.error("HMI is not connected.");
      }
      this.setWebSocketStatus();
    });

    this.haveAlarmsUpdated = function (items) {
      return (items.find(item => item.status != item.prev) != undefined) ? true : false;
    };


    this.IntervalFunc = function () {
      let current = Date.now();

      this.AnEObject.forEach(function (obj) {
        //  check interval
        if (obj.storeInterval > 0) {
          if ((obj.lastIntervalCheck == null) || (current - (obj.lastIntervalCheck) >= (obj.storeInterval * 1000))) {
            this.iaCloudObjectSend(obj, (obj.lastIntervalCheck == null)); //  初回だけ変化通知のフラグをONする
            obj.lastIntervalCheck = current;
          }
        }
      }, this);

      this.AnEObject.forEach(function (obj) {
        //  check async
        if (obj.asyncInterval > 0) {
          if ((obj.lastValueChangedCheck == null) || (current - (obj.lastValueChangedCheck) >= (obj.asyncInterval * 1000))) {
            obj.lastValueChangedCheck = current;
            if (this.haveAlarmsUpdated(obj.ObjectContent.contentData) == false) {
              return;
            }

            this.iaCloudObjectSend(obj, true);
          }
        }
      }, this);
    };

    this.sendObjectId = setInterval(this.IntervalFunc.bind(this), (1000));


    // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして早出する関数
    this.iaCloudObjectSend = function (iaObject, valuechanged) {

      this.status({ fill: "blue", shape: "ring", text: "runtime.preparing" });

      let msg = { request: "store", dataObject: { ObjectContent: {} } };
      let contentData = [];

      msg.dataObject.objectKey = iaObject.objectKey;
      msg.dataObject.timeStamp = moment().format();
      msg.dataObject.objectType = "iaCloudObject";
      msg.dataObject.objectDescription = iaObject.objectDescription;
      msg.dataObject.ObjectContent.contentType = "Alarm&Event";

      iaObject.ObjectContent.contentData.forEach(function (item) {
        let status = "";
        if (item.status == null) {
          status = (item.status == item.prev) ? "off" : "reset";
        } else {
          status = (item.status == item.prev) ? "on" : "set";
        }

        let dItem = {};
        dItem.AnEStatus = status;
        dItem.AnECode = item.code;
        if (!dItem.AnECode) { dItem.AnECode = item.varName; }
        dItem.AnEDescription = item.description;
        if (!dItem.AnEDescription) { dItem.AnEDescription = item.message; }
        contentData.push(dItem);

        if (valuechanged) { item.prev = item.status; }
      }, this);

      msg.dataObject.ObjectContent.contentData = contentData;
      msg.payload = contentData;

      this.send(msg);
      this.status({ fill: "green", shape: "dot", text: "runtime.sent" });

      this.setWebSocketStatus();
    }

    this.on("input", function (msg) {
      if (!this.hmiCom.flagOpened) {
        //  HMIの接続されていない場合はエラーとする
        this.error("HMI is not connected.", msg);
        return;
      }

      this.AnEObject.forEach(function (obj) {
        this.iaCloudObjectSend(obj, false);
      }, this);
    });

    this.on("close", function () {
      clearInterval(this.sendObjectId);
      this.hmiCom.emit("delLinkData", this.id);
    });
  }

  RED.nodes.registerType("HMI-Schneider-AE", hmiSchneiderAE);

}
