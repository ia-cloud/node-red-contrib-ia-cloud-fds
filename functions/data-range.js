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

"use strict";
const moment = require("moment");
module.exports = function(RED) {

    function dataRange(config) {

        RED.nodes.createNode(this, config);

        const node = this;
        // copy config properties
        const objFilter = config.objFilter;
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
                    let dataValue = Number(dataItem.dataValue);
                    switch (rule.mode) {
                        case "scale":
                            dataValue = Number(rule.offset) + Number(rule.gain) * dataValue;
                            break;
                        case "limit":
                            if (dataValue > Number(rule.Hlimit)) dataValue = Number(rule.Hlimit);
                            if (dataValue < Number(rule.Llimit)) dataValue = Number(rule.Llimit);
                            break;
                        default:
                    }
                    dataItem.dataValue = dataValue;
                }         
            }

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

    RED.nodes.registerType("data-range",dataRange);
}
