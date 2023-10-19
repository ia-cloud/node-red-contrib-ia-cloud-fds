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
const minCycle = 1;

module.exports = function(RED) {

    function eqStatus(config) {

        RED.nodes.createNode(this, config);

        const node = this;
        // copy config properties
        const rules = config.rules;

        // buffer for each data item evalueation 
        let status = "", preStatus = [config.BGStatus,];

        // no rule found
        if (rules.length === 0)
            node.status({fill:"yellow", shape:"ring", text:"runtime.norule"});
        else
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
                iaCloudObjectSend();
            }
        }, (minCycle * 1000));

        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして送出する関数
        const iaCloudObjectSend = function() {

            let statusMsg = {
                request: "store",
                dataObject: {
                    objectContent: {
                        contentType: config.contentType,
                        contentData:[]
                    }
                }
            }
            statusMsg.dataObject.objectKey = config.objectKey;
            statusMsg.dataObject.timestamp = moment().format();
            statusMsg.dataObject.objectType = "iaCloudObject";
            statusMsg.dataObject.objectDescription = config.objectDescription;

            statusMsg.dataObject.objectContent.contentData = [{
                commonName: config.commonName,
                dataName: config.dataName,
                dataValue: status
            }];
            statusMsg.payload = statusMsg.dataObject.objectContent.contentData;

            node.send(statusMsg);
            node.status({fill:"green", shape:"dot", text:"runtime.output"});
        }

        // input message listener
        this.on("input",function(msg, send) {
            // payload not exist,empty or no rule, do nothing
            if (rules.length === 0 || !msg.request == "store" || !msg.dataObject) return;

            // objectKey is within rule list ?
            let rls = rules.filter(rl => {
                return rl.objectKey === msg.dataObject.objectKey;
            });
            // no parameter to do
            if (!rls.length) return;

            let dataItems = msg.dataObject.objectContent.contentData.concat();

            for (let i = 0; i < dataItems.length; i++) {

                let dataItem = dataItems[i];     // set target dataItem

                // AnECode dose match with para's event name?
                let rule = rls.find(rl => dataItem.dataValue.AnECode === rl.eventName);
                if (!rule) continue;

                if (dataItem.hasOwnProperty("dataValue")) {
                    if (dataItem.dataValue.AnEStatus === "set")
                        rule.result = "set";
                    else if (dataItem.dataValue.AnEStatus === "reset")
                        rule.result = "reset";
                    else rule.result = "";
                } 
            }
            let rule = rules.find(rl => rl.result === "set" || rl.result === "reset");
            if (!rule || !rule.result) return;

            if (rule.result === "set") {
                status = rule.status;
                preStatus.push(status);
            }
            else if (rule.result === "reset") {
                let index = preStatus.findIndex((elm) => elm === rule.status);
                if (index !== -1) {

                    if (index === preStatus.length - 1) {
                        preStatus.splice(index,1);
                        status = preStatus.slice(-1)[0];
                    }
                    else {
                        preStatus.splice(index,1);
                        rule.result === "";
                        return;
                    }
                }
                else return;
            };
            rule.result = "";
            iaCloudObjectSend ();
        }); 

        this.on("close",function() {
            clearInterval(sendObjectId);
        });
    }

    RED.nodes.registerType("eq-status",eqStatus);
}
