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
        var linkObj = {Coil:[], IS:[], IR:[], HR:[]};
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
            // 更新結果に変化があり、変化通知フラグのある項目は、登録されたchangeListenerを呼ぶ
            // 変化通知を要求したNodeのリスナーをコール(引数はobjectKeyの配列)
            Object.keys(listeners).forEach(function(nodeId) {
              if (nodeId) {
                var modbusNode = RED.nodes.getNode(nodeId);
                if (modbusNode) modbusNode.linkDatachangeListener(listeners[nodeId]);
              }
            });
          }, refreshCycle * 100);

        }
        // modbus通信のコールバック関数
        // 通信のレスポンスフレームのデータでlinkObjのvalueを更新、
        // さらに、変化イベントのリスナーが登録されていたら、各Nodeのリストイに追加
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
                // 要求元のModbus Object Nodeとオブジェクトキーを登録
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
          Array.prototype.push.apply(linkObj.Coil, lObj.Coil);
          Array.prototype.push.apply(linkObj.IS, lObj.IS);
          Array.prototype.push.apply(linkObj.IR, lObj.IR);
          Array.prototype.push.apply(linkObj.HR, lObj.HR);
        }

var gContext = this.context().global;
var list1 = [123,234,345,-456,567,-678,789,-3450,4561,5672];
var list2 = [1,1,0,0,1,1,1,0,0,0];
var list3 = ["0x4142","0x4344","0x4546","0x4a4b","0x4c4d","0x3a3c","0x7273","0x6b6e","0x2f32","0x5100"];
var list4 = ["0x0291","0x0032","0x4546","0x9529","0x2893","0x8166","0x7545","0x9001","0x1337","0x5161"];
gContext.set("list1", list1);
gContext.set("list2", list2);
gContext.set("list3", list4);
gContext.set("list4", list4);
        var modbusRead = function(dev, start, number, callback) {
          var fcode;
          switch(dev) {
            case "Coil" : fcode = 1;   break;
            case "IS" : fcode = 2;   break;
            case "HR" : fcode = 3;   break;
            case "IR" : fcode = 4;   break;
          }
          // プロパティを基に、modbus通信（TCP,RTU,ASCIIのいずれか）を実施
          // modbus通信で取得したデータは、ビットデバイスは、"1" or "0"（文字列表現）、
          // ワードデバイスは、2桁16進文字列表現で（例："2b" "fc" "e3"）、
          // 以下のコールバック関数のlist引数で返される。
          // 以下はダミーデータ

list1 = gContext.get("list1");
list2 = gContext.get("list2");

var top1 = list1[0];
var top2 = list2[0];
var top3 = list3[0];
var top4 = list4[0];
list1.shift();
list1.push(top1);
list2.shift();
list2.push(top2);
list3.shift();
list3.push(top3);
list4.shift();
list4.push(top4);
gContext.set("list1", list1);
gContext.set("list2", list2);
gContext.set("list3", list3);
gContext.set("list4", list4);
number = 10;
var list = [];
// bit のテストデータ
// for (var i = 0; i < number; i++) {list.push(((list2[i] == 0) ? "0" : "1"));}
// number、nnumListのテストデータ
// for (var i = 0; i < number; i++) {list.push("0x" + ("0000" + (list1[i] >>> 0).toString(16)).slice(-4));}
// stringのテストデータ
 list = list3;
// BCDのテストデータ
// list = list4;
console.log(list);
callback(dev, start, number, list);
        }
    }

    RED.nodes.registerType("Modbus-com",modbusCom);

}
