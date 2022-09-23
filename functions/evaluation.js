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

    function evaluation(config) {

        RED.nodes.createNode(this, config);

        const node = this;
        // copy config properties
        const objFilter = config.objFilter;
        const actionType = config.actionType;
        const rules = config.rules;

        // buffer for previous value
        let prevs = []
        prevs.length = rules.length;

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
            // no parameter to do
            if (!rls.length) {
                // pass thru non target object ?
                if (!objFilter) send(msg);
                return;
            } 

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
                // if yes, convert to boolean dataValue
                if (actionType === "bool") 
                    dataItem.dataValue = result;
                // if yes, convert to boolean dataValue
                if (actionType === "01") 
                    dataItem.dataValue = Number(result);
                // if yes, convert to equipementStatus dataValue
                if (actionType === "epSt") {
                    if (result) dataItem.dataValue = prevs[i]? "on": "start";
                    else dataItem.dataValue = prevs[i]? "stop": "off";
                    prevs[i] = result;
                }
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
