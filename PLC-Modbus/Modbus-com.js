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

    function modbusCom(config) {
        RED.nodes.createNode(this, config);

        let ModbusRTU = require('modbus-serial')

        this.host = config.etherAdd;
        this.port = Number(config.etherPort);
        this.unitid = Number(config.unitID);
        this.refreshCycle = Number(config.refreshCycle);
        this.maxDataNum = Number(config.maxDataNum);
        this.noBlanck = config.noBlanck;

        var node = this;
        var linkObj = {Coil:[], IS:[], IR:[], HR:[]};
        var addTbl = {};        // Modbus通信でアクセスするデバイスのアドレステーブル
        // Modbus通信で取得したデータに変化があった時にコールするリスナ関数のを持つNodeIDと、
        // そのデータを使用しているオブジェクトキー
        // // {nodeID:[objectKey, ]}　の構造を持つ
        var listeners = {};
        var comList = [];       // Modbus通信フレーム情報
        var flagRecon = false;  // Modbus通信フレーム情報の再構築フラグ

        node.client = null;
        node.client = new ModbusRTU();

        node.reconfigLinkObj = function() {
            //作成したリンクオブジェクトに基づき、Modbus通信を実施し、リンクオブジェクトの各Valueを更新する
            //linkObjの各項目ををスキャンし、読み出すデバイスのリスト（配列）を作成。昇順に並べ重複を削除する。
            // まず、現在の通信フレーム情報をクリア
            comList.length = 0;
            Object.keys(linkObj).forEach(function (key) {
                var addList = [];
                linkObj[key].forEach(function (linkData, idx) {
                    addList.push(linkData.address);
                });
                addList.sort(function (add, next) { return add - next; });
                addTbl[key] = Array.from(new Set(addList));
            });
            //効率的な通信のため、連続読み出し領域を探し、modbus通信を行う。
            Object.keys(addTbl).forEach(function (key) {
                var addList = addTbl[key];
                var saddr;
                var dataNum = 0;
                var maxAdd;
                for (var idx = 0, l = addList.length; idx < l; idx++) {
                    var address = Number(addList[idx]);
                    if (dataNum == 0) {
                        dataNum = 1;
                        saddr = address;
                        maxAdd = address + node.maxDataNum;
                    }
                    if (node.noBlanck && address == (saddr + dataNum)) {
                        dataNum = address - saddr + 1;
                    }
                    else if (!node.noBlanck && address < maxAdd) {
                        dataNum = address - saddr + 1;
                    }else {
                        //modbus通信フレーム情報を追加
                        comList.push({ functionCode: key, address: saddr, quantity: dataNum });
                        dataNum = 1;
                        saddr = address;
                        maxAdd = address + node.maxDataNum;
                    }
                    if (idx == (l - 1)) {
                        //modbus通信フレーム情報を追加
                        comList.push({ functionCode: key, address: saddr, quantity: dataNum });
                    }
                  }
            });
        };

        node.readItemsFromPLC = async (params) => {
            await node.client.connectTCP(node.host, { port: node.port })
            .then(node.client.setID(node.unitid));
            let values = [];
            var resp;
            for (let param of params){
                switch(param.fc){
                    case "Coil": // FC:1
                        resp = await node.client.readCoils(param.addr, param.qty);
                        break;
                    case "IS": // FC:2
                        resp = await node.client.readDiscreteInputs(param.addr, param.qty);
                        break;
                    case "HR": // FC:3
                        resp = await node.client.readHoldingRegisters(param.addr, param.qty);
                        break;
                    case "IR": // FC:4
                        resp = await node.client.readInputRegisters(param.addr, param.qty);
                        break;
                    default:
                        break;
                }
                values.push({fc: param.fc, addr: param.addr, qty: param.qty, value: resp.data});
            }
            await node.client.close();
            return values;
        }

        node.modbusRead = function () {
            // 通信フレーム情報の再構成フラグがonの時は、再構成する
            if (flagRecon) {
                // 通信フレーム情報の再構成フラグをoff
                flagRecon = false;
                node.reconfigLinkObj();
            }
            //modbus通信フレーム送受信
            if (comList.length) {
                let params = [];
                comList.forEach(function (com) {
                    params.push({
                        fc    : com.functionCode,
                        addr  : com.address,
                        qty   : com.quantity,
                    });
                });
                node.readItemsFromPLC(params).then((resp) => {
                    console.log(resp);
                    for(let obj of resp){
                        storeToLinkObj(obj.fc, obj.addr, obj.qty, obj.value);
                    }
                }).catch((err) => {
                    // TODO 適切なエラー処理を追加
                    console.log(err);
                });
            }
            // 更新結果に変化があり、変化通知フラグのある項目は、登録されたchangeListenerを呼ぶ
            // 変化通知を要求したNodeのリスナーをコール(引数はobjectKeyの配列)
            Object.keys(listeners).forEach(function (nodeId) {
                if (nodeId) {
                    var modbusNode = RED.nodes.getNode(nodeId);
                    if (modbusNode)
                        modbusNode.emit("changeListener", listeners[nodeId]);
                }
            });
            listeners.length = 0; // changeListenerリストをクリア
        };

        if (node.refreshCycle > 0) {
            var cycleId = setInterval(node.modbusRead, node.refreshCycle * 1000);
        }

        // modbus通信のコールバック関数
        // 通信のレスポンスフレームのデータでlinkObjのvalueを更新、
        // さらに、変化イベントのリスナーが登録されていたら、各Nodeのリストに追加
        var storeToLinkObj = function(dev, start, num, list){
            for (var i = 0; i < num; i++) {
                var linkData = linkObj[dev].find(function(elm) {
                    return (elm.address == Number(start) + i);
                });
                if (linkData) {
                    var value_str;
                    if(dev == "Coil" || dev == "IS"){
                        if(list[i]){
                            value_str = "1";
                        }else{
                            value_str = "0";
                        }
                    }else if(dev == "HR" || dev == "IR"){
                        value_str = toHex(list[i]);
                    }
                    linkData.preValue = linkData.value;
                    linkData.value = value_str;
                    var nodeId = linkData.nodeId;
                    // 変化通知が登録されていて、前回の値に変化があったら（初回はパス）
                    if(nodeId && linkData.preValue && (linkData.value != linkData.preValue)) {
                        // 要求元のModbus Object Nodeとオブジェクトキーを登録
                        // 重複の無いように
                        // objectKeyリストがからだったら、リストに追加
                        if (!listeners[nodeId]) listeners[nodeId] = [linkData.objectKey,];
                        // 登録済みのObjectKeyでなかったら、リストに追加
                        else if (listeners[nodeId].indexOf(linkData.objectKey) == -1) {
                            listeners[nodeId].push(linkData.objectKey);
                        }
                    }
                }
            }
        };
        var toHex = function(v) {
            return '0x' + (('0000' + v.toString(16).toUpperCase()).substr(-4));
        }

        node.on("input",function(msg) {});
        node.on("close",function() {
            clearInterval(cycleId);
        });
        node.on("addLinkData",function(lObj) {
            console.log("node.onのaddlinkDataが呼ばれた");
            // linkObjに新たなリンクデータを追加
            Array.prototype.push.apply(linkObj.Coil, lObj.Coil);
            Array.prototype.push.apply(linkObj.IS, lObj.IS);
            Array.prototype.push.apply(linkObj.IR, lObj.IR);
            Array.prototype.push.apply(linkObj.HR, lObj.HR);
            // linkObjが変更されたので、通信フレーム情報の再構築フラグをon
            flagRecon = true;
        });

var gContext = node.context().global;
var list1 = [123,234,345,-456,567,-678,789,-3450,4561,5672];
var list2 = [1,1,0,0,1,1,1,0,0,0];
// utf-8
 var list3 = ["0xE381","0x93E3","0x828C","0xE381","0xAFE3","0x8386","0xE382","0xB9E3","0x8388","0x0000"];
// shiftjis
// var list3 = ["0x82B1","0x82EA","0x82CD","0x8365","0x8358","0x8367","0x82C5","0x82B7","0x8142","0x0000"];
// eucjP
// var list3 = ["0xA4B3","0xA4EC","0xA4CF","0xA5C6","0xA5B9","0xA5C8","0xA4C7","0xA4B9","0xA1A3","0x0000"];
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
