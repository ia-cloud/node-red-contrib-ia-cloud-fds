
module.exports = function(RED) {
    "use strict";
    var request = require("request");
    var moment = require("moment");

    const iconv = require("iconv-lite");

    function omronTempCtrl(config) {

        RED.nodes.createNode(this,config);

        // オムロン温調計ModbsアドレスMap
        const OMRON_MAP = {
          pv: { device: "HR", dataAdd: 0x2402, dp: 0x2410, mask: null },
          sv: { device: "HR", dataAdd: 0x2403, dp: 0x2410, mask: null },
          pro: { device: "HR", dataAdd: 0x2a00, dp: 0x3309, mask: null },
          int: { device: "HR", dataAdd: 0x2a01, dp: 0x3309, mask: null },
          div: { device: "HR", dataAdd: 0x2a02, dp: 0x3309, mask: null },
          run: { device: "HR", dataAdd: 0x2407, dp: null, mask: 0x0100 },
          am: { device: "HR", dataAdd: 0x2407, dp: null, mask: 0x0400 },
          at: { device: "HR", dataAdd: 0x2407, dp: null, mask: 0x0080 },
        }
        var node = this;
        var dataObjects = [{}];
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
            dataObjects.forEach(function(objItem, idx) {
                var objectKey = objItem.objectKey;
                var nodeId = (objItem.options.storeAsync)? node.id: "";
                // 定期収集のためのカウンターをセット
                objItem.options.timeCount = objItem.options.storeInterval;
                // dataItemを一つづつ取り出し、ModbuslinkDataを設定

                objItem.ObjectContent.contentData.forEach(function(dataItem, index) {
                    var source = dataItem.options.source;
                    var device = OMRON_MAP[source].device;
                    var dataAdd = OMRON_MAP[source].dataAdd;
                    var linkData = {address: "", value: "", preValue: "", nodeId: null, objectKey: ""};
                    linkData.address = dataAdd;
                    linkData.nodeId = nodeId;
                    linkData.objectKey = objectKey;
                    linkObj[device].push(linkData);
                    // 小数点位置が規定されていたら
                    var dp = OMRON_MAP[source].dp;
                    if (dp) {
                      var dpData = {address: "", value: "", preValue: "", nodeId: null, objectKey: ""};
                      dpData.address = dp;
                      dpData.nodeId = nodeId;
                      dpData.objectKey = objectKey;
                      linkObj[device].push(dpData);
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
              var source = dataItem.options.source;
              delete dItem.options;

              var device = OMRON_MAP[source].device;
              var dataAdd = OMRON_MAP[source].dataAdd;

              dItem.dataValue = 0;
              // 対応するlinkDataを探し、0x表現の下4桁を取り出しす
              var value = linkObj[device]
                    .find(function(lData){
                      return (lData.address == Number(dataAdd));}).value.slice(-4);
              var mask = OMRON_MAP[source].mask;
              var dp = OMRON_MAP[source].dp;
              var dpValue;
              if (dp) {
                  // 小数点位置を調整
                  dpValue = linkObj[device]
                      .find(function(lData){ return (lData.address == dp); }).value.slice(-4)
                  dpValue = parseInt(dpValue, 16);
                  // 2の歩数に変換し倍率をかける
                  dItem.dataValue = (-1 - ~parseInt(value, 16)) * 10^dpValue;
              } else {
                  dItem.dataValue = (-1 - ~parseInt(value, 16));               
              }
              if(mask){
                  // マスクしてBooleanに変換
                  dItem.dataValue = !!(parseInt(value, 16) & mask);
              }
              contentData.push(dItem);
          });
          msg.dataObject.ObjectContent.contentData = contentData;
          msg.payload = RED._("runtime.sent");
          node.send(msg);
          node.status({fill:"green", shape:"dot", text:"runtime.sent"});
        }
        this.on("input",function(msg) {
          //何もしない
        });
        this.on("close",function() {
          clearInterval(sendObjectId);
        });
    }

    RED.nodes.registerType("tmp-ctrl-omron",omronTempCtrl);

}
