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
console.log(config);
        var linkObj = [];
        var linkData = {address:"", notify: false, value:""};
        var notifyObj;
        var storeInterval = config.storeInterval;


        //setInterval(function(){
          //前回から追加されたlinkDataがあれば、linkObjをアドレス順に再構築する。
          //作成したリンクオブジェクトに基づき、Modbus通信を実施し、リンクオブジェクトの各Valueを更新する
          //いろいろな処理
          //更新結果に変化があり、変化通知フラグのある項目は、メーセージ出力する
          //this.send(notifyObj);
        //}, storeInterval);

        this.on("input",function(msg) {/*何もしない？*/});

        this.on("close",function() {/*何もしない？*/});
    }

    RED.nodes.registerType("Modbus-com",modbusCom);

    modbusCom.prototype.addLinkData = function (linkData) {
      //linkObjにlinkDataを追加する関数、PLC-Modbusから呼ばれる。
      //削除する関数はいらないか？　多分いらない。
    }
}
