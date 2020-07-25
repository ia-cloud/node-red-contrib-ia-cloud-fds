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

"use strict";
const moment = require("moment");
module.exports = function(RED) {

    function evaluation(config) {

        RED.nodes.createNode(this, config);

        const node = this;
        // copy config properties
        const actionType = config.actionType;
        const rules = config.rules;

        // no rule found
        if (rules.length === 0)
            node.status({fill:"yellow", shape:"ring", text:"runtime.norule"});
        else
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // input message listener
        this.on("input",function(msg, send) {
            // payload not exist,empty or no rule, do nothing
            if (rules.length === 0 || !msg.request == "store" || !msg.dataObject) return;

            // objectKey is within rule list ?
            let rls = rules.filter(rl => {
                return rl.objectKey === msg.dataObject.objectKey || rl.objectKey === "";
            });
            if (!rls) return;

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
                    if (typeof dataValue === "boolean" || typeof dataValue === "number" || typeof dataVaule === "string" ) {
                        switch (rule.mode) {
                            case "equal":
                                result = (dataValue == rule.equal)? true: false;
                                break;
                            case "notequal":
                                result = (dataValue != rule.equal)? true: false;
                                break;
                            case "range":
                                if (rule.rangeLo !== "" && rule.rangeHi !== "") {
                                    if (rule.rangeLo < dataValue && dataValue < rule.rangeHi) result = true;
                                } else if (rule.rangeLo === "") {
                                    if (dataValue < rule.rangeHi) result = true;
                                }
                                else if (rule.rangeHi === "") {
                                    if (rule.rangeLo < dataValue) result = true;
                                }
                                break;
                            case "notrange":
                                if (rule.notrangeLo !== "" && rule.notrangeHi !== "") {
                                    if (dataValue < rule.notrangeLo && rule.notrangeHi < dataValue) result = true;
                                } else if (rule.notrangeLo === "") {
                                    if (dataValue > rule.notrangeHi) result = true;
                                }
                                else if (rule.notrangeHi === "") {
                                    if (rule.notrangeLo > dataValue) result = true;
                                }
                                break;
                            default:
                        }
                    }
                }
                // if yes, convert to boolean dataValue
                if (actionType === "bool") 
                    dataItem.dataValue = result;
                // if yes, discard the dataItem
                if (actionType === "indiv") 
                    if(!result) {
                        dataItems[i] = {};
                    }

                // if yes, quit message send
                if (actionType === "whole") 
                    if(!result) return;           
            }
            // get "dataItem == {}" filtered
            dataItems = dataItems.filter(item => {return item.hasOwnProperty("dataName")});

            if (dataItems.length) {
                msg.dataObject.objectContent.contentData = dataItems;
                msg.payload = dataItems;
                // output message to the port
                send(msg);
                node.status({fill:"green", shape:"dot", text:"runtime.output"});
            }else {
                node.status({fill:"green", shape:"ring", text:"runtime.nomatch"});
            }
        }); 
    }

    RED.nodes.registerType("evaluation",evaluation);
}