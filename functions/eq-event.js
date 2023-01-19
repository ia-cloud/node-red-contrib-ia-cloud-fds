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

    function eqEvent(config) {

        RED.nodes.createNode(this, config);

        const node = this;
        // copy config properties
        const rules = config.rules;

        // buffer for each data item evalueation 
        let value = false, prevalue = false;

        // no rule found
        if (rules.length === 0)
            node.status({fill:"yellow", shape:"ring", text:"runtime.norule"});
        else
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // 定期収集のためのカウンターをセット
        let timeCount = config.storeInterval? parseInt(config.storeInterval): 0;

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
                        contentType: "",
                        contentData:[]
                    }
                }
            }
            statusMsg.dataObject.objectKey = config.objectKey;
            statusMsg.dataObject.timestamp = moment().format();
            statusMsg.dataObject.objectType = "iaCloudObject";
            statusMsg.dataObject.objectDescription = config.objectDescription;
            statusMsg.dataObject.objectContent.contentType = config.contentType;

            let AnEStatus;
            if (value) AnEStatus = prevalue? "on": "set";
            else AnEStatus = prevalue? "reset": "off";   
            statusMsg.dataObject.objectContent.contentData = [{
                commonName: "Alarm&Event",
                dataValue: {
                    AnEStatus : AnEStatus,
                    AnECode : config.AnECode,
                    AnEDescription : config.AnEDesc
                }
            }];

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

                // dataName or commonName dose match para's ?
                let rule = rls.find(rl => { return (rl.dataName === ""
                    || dataItem.dataName === rl.dataName
                    || dataItem.commonName === rl.dataName)
                });
                if (!rule) continue;

                let result = false;
                if (dataItem.hasOwnProperty("dataValue")) {
                    let dataValue = dataItem.dataValue;
                    switch (rule.mode) {
                        case "equal":
                            if (typeof dataValue === "boolean" || typeof dataValue === "number" 
                                || typeof dataVaule === "string" )
                                // check equality, (not identity)
                                result = (dataValue == rule.equal)? true: false;
                            break;
                        case "notequal":
                            if (typeof dataValue === "boolean" || typeof dataValue === "number" 
                                || typeof dataVaule === "string" )
                                // check inequality, (not nonidentity)
                                result = (dataValue != rule.equal)? true: false;
                            break;
                        case "range":
                            if (typeof dataValue === "number" || typeof dataVaule === "string" ) {
                                if (rule.rangeLo !== "" && rule.rangeHi !== "") {
                                    if (rule.rangeLo < dataValue && dataValue < rule.rangeHi) result = true;
                                } else if (rule.rangeLo === "") {
                                    if (dataValue < rule.rangeHi) result = true;
                                }
                                else if (rule.rangeHi === "") {
                                    if (rule.rangeLo < dataValue) result = true;
                                }
                            }
                            break;
                        case "notrange":
                            if (typeof dataValue === "number" || typeof dataVaule === "string" ) {
                                if (rule.notrangeLo !== "" && rule.notrangeHi !== "") {
                                    if (dataValue < rule.notrangeLo || rule.notrangeHi < dataValue) result = true;
                                } else if (rule.notrangeLo === "") {
                                    if (dataValue > rule.notrangeHi) result = true;
                                }
                                else if (rule.notrangeHi === "") {
                                    if (rule.notrangeLo > dataValue) result = true;
                                }
                            }
                            break;
                        default:
                    }
                }
                
                rule.result = result;     
            }

            if (config.andor === "and") {
                value = true;
                for (let rl of rules) {value = value && rl.result;}
            } else {
                value = false;
                for (let rl of rules) {value = value || rl.result;}
            }
            iaCloudObjectSend ();
            prevalue = value;
        }); 

 
        this.on("close",function() {
            clearInterval(sendObjectId);
        });
    }

    RED.nodes.registerType("eq-event",eqEvent);
}
