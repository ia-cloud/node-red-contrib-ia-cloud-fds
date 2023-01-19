/**
 * Copyright 2019 ia-cloud project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = function(RED) {
    "use strict";
    var request = require("request");
    var moment = require("moment");

    function objectArray(config) {

        RED.nodes.createNode(this,config);
        var node = this;
        var dataObject = [{}];
        var storeObj;
        var minCycle = 10; // 最小収集周期を10秒に設定
        var timeCount = config.interval;
        var lengthCount = 0;
        var objArray = [];

        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        var sendObjectId = setInterval(function(){
            // 10秒周期でカウントし、カウントアップしたら、メッセージ出力を行う。
            
            if(config.interval != "0") {
              // 収集周期前であれば何もせず
              if (timeCount -= minCycle > 0) return;
              // 収集周期がきた。収集周期を再設定。
              timeCount = config.interval;
              objectArraySend();
            }
        }, (minCycle * 1000));

        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして送出する関数
        var objectArraySend = function() {

            node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

            var msg = { request: "store", dataObject: {objectArray:[]} };

            if(lengthCount > 0) {

                msg.dataObject.objectKey = config.objectKey;
                msg.dataObject.timestamp = moment().format();
                msg.dataObject.objectType = "iaCloudObjectArray";
                msg.dataObject.objectDescription = config.objectDescription;
                msg.dataObject.length = lengthCount;
                msg.dataObject.objectArray = Object.assign({}, objArray);

                msg.payload = RED._("runtime.sent");
                node.send(msg);
                node.status({fill:"green", shape:"dot", text:"runtime.sent"});
                // メッセージを送出したので、オブジェクト配列を空にする。
                lengthCount = 0;
                objArray.length = 0;
            }
        }

        this.on("input",function(msg) {
            if (msg.request == "store" && msg.dataObject) {
                objArray.push(msg.dataObject)
                lengthCount += 1;
                if (lengthCount >= config.length) objectArraySend();
            }
        });
        this.on("close",function() {
          clearInterval(sendObjectId);
        });
    }

    RED.nodes.registerType("object-array",objectArray);

}
