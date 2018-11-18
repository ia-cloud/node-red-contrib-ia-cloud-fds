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

    function PLCModbus(config) {

        RED.nodes.createNode(this,config);

        var node = this;
        var configObj = {};
        var storeObj;

        if (config.confsel == "fileSet"){
          // 設定ファイルの場合、ファイルを読み込んで、オブジェクトに展開

        } else {
          // オブジェクトがプロパティで設定されている場合、プロパティを読み込んでオブジェクトを生成
          //いろいろな処理
        }
        // configObjから通信するPLCデバイス情報を取り出し、ModbusCom Nodeに設定
        //いろいろな処理

        //setInterval(function(){
          //設定された格納周期で,ModbusCom Nodeからデータを取得し、ia-cloudオブジェクトを生成、メッセージで送出
          //いろいろな処理
          //複数の周期でオブジェクトの格納をするため、10秒周期でカウントし、カウントアップしたら、オブジェクト生成、メッセージ出力を行う。
          //this.send(storeObj);
        //}, 10 * 1000);  // 10秒単位で実行


        //this.on("input",function(msg) {
          //ModbusCom Nodeから変化のあったデータを取得し、ia-cloudオブジェクトを生成、メッセージで送出
          //いろいろな処理
          //this.send(storeObj);
        //});

        this.on("close",function() {

        });
    }

    RED.nodes.registerType("PLC-Modbus",PLCModbus);
}
