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

    function unpack(config) {

        RED.nodes.createNode(this,config);
        const node = this;
        // Nodeのconfigパラメータから、rulesをコピー
        const rules = config.rules;
        // no rule found
        if (rules.length === 0)
            node.status({fill:"yellow", shape:"ring", text:"runtime.norule"});
        else
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // input message listener
        this.on("input",function(msg, send) {

            // payload not exist,empty or no rule, do nothing
            if (rules.length === 0 || !msg.request === "store" || !msg.dataObject) return;

            let msgs = [];

            // search objectKey and dataItem that as same as in the rules
            for (let i = 0; i < rules.length; i++) {

                let rule = rules[i];

                //  match objectKey ?
                if (rule.objectKey !== msg.dataObject.objectKey && rule.objectKey !== "") 
                    continue;

                let dataItem = msg.dataObject.objectContent.contentData.find(dItem => {
                    return dItem.dataName === rule.dataName || dItem.commonName === rule.dataName
                });
                if (dataItem && dataItem.hasOwnProperty("dataValue")) {
                    if (!rule.dataLabel) rule.dataLabel = dataItem.dataName;
                    msgs[i] = {
                        payload: dataItem.dataValue,
                        topic: rule.dataLabel,
                        label: rule.dataLabel
                    };
                    if (config.bool10) msgs[i].payload = Number(msgs[i].payload);
                }
            }
            // output message to the each port
            if (msgs.length !== 0) {
                send(msgs);
                node.status({fill:"green", shape:"dot", text:"runtime.output"});
            } else {
                node.status({fill:"green", shape:"ring", text:"runtime.nomatch"});
            }
        }); 
    }

    RED.nodes.registerType("unpack",unpack);
}
