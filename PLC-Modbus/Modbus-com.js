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

    function modbusCom(config) {

        RED.nodes.createNode(this,config);

        var node = this;
        var linkObj = {coil:[], inputStatus:[], inputRegister:[], holdingRegister:[]};
        var refreshCycle = config.refreshCycle;
        var maxDataNum = config.maxDataNum;
        var noBlanck = config.noBlanck;
        var addTbl = {};
        var listeners = [];

        if (refreshCycle > 0) {
          var cycleId = setInterval(function(){
            //作成したリンクオブジェクトに基づき、Modbus通信を実施し、リンクオブジェクトの各Valueを更新する
            //linkObjの各項目ををスキャンし、読み出すデバイスのリスト（配列）を作成。昇順に並べ重複を削除する。
            Object.keys(linkObj).forEach(function(key) {
              var addList = [];
              linkObj[key].forEach(function(linkData, idx) {
                addList.push(linkData.address);
              });
              addList.sort(function(add,next){ return add - next; });
              addTbl[key] = Array.from(new Set(addList));
            });
            //効率的な通信のため、連続読み出し領域を探し、modbus通信を行う。
            Object.keys(addTbl).forEach(function(key) {
              var addList = addTbl[key];
              var saddr;
              var dataNum = 0;
              var maxAdd;
              for (var idx = 0, l = addList.length; idx < l; idx++) {
                var address = Number(addList[idx]);
                if (dataNum == 0) {
                  dataNum = 1;
                  saddr = address;
                  maxAdd = address + Number(maxDataNum);
                }
                if (noBlanck && address == (saddr + dataNum)) {
                    dataNum = address - saddr + 1;
                }
                else if (!noBlanck && address < maxAdd) {
                    dataNum = address - saddr + 1;
                }else {
                  //modbus通信フレームを作成し送信
                  modbusRead(key, saddr, dataNum, storeToLinkObj);
                  dataNum = 1;
                  saddr = address;
                  maxAdd = address + Number(maxDataNum);
                }
                if (idx == (l - 1)) {
                  //modbus通信フレームを作成し送信
                  modbusRead(key, saddr, dataNum, storeToLinkObj);
                }
              }
            });
            //更新結果に変化があり、変化通知フラグのある項目は、登録されたchangeListenerを呼ぶ
            // 変化通知を要求したNodeのリスナーをコール
console.log(listeners);
            Object.keys(listeners).forEach(function(nodeId) {
              if (nodeId) {
                var modbusNode = RED.nodes.getNode(nodeId);
                listeners[nodeId].forEach(function(objectKey) {
                  if (modbusNode) modbusNode.linkDatachangeListener(objectKey);
                });
              }
            });
          }, refreshCycle);

        }
        // modbus通信のコールバック関数
        // 通信のレスポンスフレームのデータでlinkObjのvalueを更新、
        // さらに、変化イベントのリスナーが登録されていたらコール
        var storeToLinkObj = function(dev, start, num, list){
          for (var i = 0; i < num; i++) {
            var linkData = linkObj[dev].find(function(elm) {
                            return (elm.address == Number(start) + i);});
            if (linkData) {
              linkData.preValue = linkData.value;
              linkData.value = list[i];
              var nodeId = linkData.nodeId;
              // 変化通知が登録されていて、前回の値に変化があったら（初回はパス）
              if(nodeId && linkData.preValue && linkData.value != linkData.preValue) {
                // 要求元のModcus Object Nodeとオブジェクトキーを登録
                // 重複の無いように
                if (!listeners[nodeId]) listeners[nodeId] = [linkData.objectKey,];
                else if (listeners[nodeId].indexOf(linkData.objectKey) == -1) {
                    listeners[nodeId].push(linkData.objectKey);
                }
              }
            }
          }
        }

        this.on("input",function(msg) {});

        this.on("close",function() {
          clearInterval(cycleId);
        });

        modbusCom.prototype.addLinkData = function (lObj) {
console.log("addlinkDataが呼ばれた");
          // linkObjに新たなリンクデータを追加
          Array.prototype.push.apply(linkObj.coil, lObj.coil);
          Array.prototype.push.apply(linkObj.inputStatus, lObj.inputStatus);
          Array.prototype.push.apply(linkObj.inputRegister, lObj.inputRegister);
          Array.prototype.push.apply(linkObj.holdingRegister, lObj.holdingRegister);
        }
    }

    RED.nodes.registerType("Modbus-com",modbusCom);


    var modbusRead = function(dev, start, number, callback) {
      var fcode;
      switch(dev) {
        case "coil" : fcode = 1;   break;
        case "inputStatus" : fcode = 2;   break;
        case "holdingRegister" : fcode = 3;   break;
        case "inputRegister" : fcode = 4;   break;
      }
      // プロパティを基に、modbus通信（TCP,RTU,ASCIIのいずれか）を実施
      // 以下はダミーデータ
      var list = [moment().seconds(),2,3,moment().seconds(),5,6,7,8,9,10];
      number = 10;

      callback(dev, start, number, list);
    }
}
