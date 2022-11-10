/**
 * Copyright 2019 Hiro Hashimukai on the ia-cloud project
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

"use strict";

const moment = require("moment");

module.exports = function(RED) {

    function iaCloudSimulator(config) {

        RED.nodes.createNode(this,config);

        let node = this;
        let items = config.dataItems;
        let storeAsync = config.storeAsync;
        let myObjKey = config.objectKey;
        let qInfo = config.qInfo;

        const minCycle = 1; // 最小収集周期を10秒に設定
        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        let buff = [{}];

        // Nodeステータスを　Readyに
        node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // 定期収集のためのカウンターをセット
        let timeCount = config.storeInterval;

        let sendObjectId = setInterval(function(){
            // 設定された格納周期で,ModbusCom Nodeからデータを取得し、ia-cloudオブジェクトを
            // 生成しメッセージで送出
            if(config.storeInterval != "0") {
                // 収集周期前であれば何もせず
                timeCount = timeCount - minCycle;
                if (timeCount > 0) return;
                // 収集周期がきた。収集周期を再設定。
                timeCount = config.storeInterval;
                iaCloudObjectSend(myObjKey);
            }
        }, (minCycle * 1000));

        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして送出する関数
        const iaCloudObjectSend = function() {

            let msg = {request:"store", dataObject:{objectContent:{}}};
            let contentData = [];

            msg.dataObject.objectKey = myObjKey;
            msg.dataObject.timestamp = moment().format();
            msg.dataObject.objectType = "iaCloudObject";
            msg.dataObject.objectDescription = config.objectDescription;
            msg.dataObject.objectContent.contentType = config.contentType;

            let source, device, dataAdd;
            items.forEach(function(dataItem, index) {

                let dItem = {
                    dataName: dataItem.dataName,
                    dataValue: null,
                    unit: dataItem.unit,
                };
                if (qInfo) dItem.quality = ""

                // searching dataName
                let item = buff.find(function(buffItem){
                        return (buffItem.dataName === dataItem.dataName);
                    });
                if (item) {
                    dItem.dataValue = item.dataValue;
                    if (qInfo) dItem.quality = "good";
                }
                else {
                    dItem.dataValue = null;
                    if (qInfo) dItem.quality = "not good";
                }
                contentData.push(dItem);
            });
            msg.dataObject.objectContent.contentData = contentData;
            msg.payload = contentData;
            node.send(msg);
            node.status({fill:"green", shape:"dot", text:"runtime.sent"});
        }

        this.on("input",function(msg) {
            if(msg.topic) {
                // is exist in data buffer ?
                let buffItem = buff.find(function(item){ return (item.dataTopic == msg.topic); });
                if (buffItem) {
                    // if data changed on async. store
                    if (buffItem.dataValue !== msg.payload && storeAsync) msg.trigger = true;
                    buffItem.dataValue = msg.payload;
                } 
                // push a new buffer item if it exists in contentData items
                else {
                    let item = items.find(function(item){ return (item.dTopic == msg.topic); });
                    if (item) {
                        buff.push({
                            dataTopic: item.dTopic,
                            dataName:item.dataName,
                            dataValue: msg.payload
                        })
                    }
                    // on async. store
                    if (storeAsync) msg.trigger = true;
                }
            }
            // is it a trigger for ia-cloud object output ?
            if (msg.trigger) iaCloudObjectSend();
            
        });

        this.on("close",function() {
            clearInterval(sendObjectId);
        });
    }

    RED.nodes.registerType("ia-cloud-simulator",iaCloudSimulator);

}
