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

module.exports = function(RED) {
    "use strict";

    function renameData(config) {

        RED.nodes.createNode(this,config);
        const node = this;
        const objFilter = config.objFilter;
        const dItemFilter = config.dItemFilter;

        // Nodeのconfigパラメータから、rulesをコピー
        const rules = config.rules;
        // no rule found
        if (rules.length === 0)
            node.status({fill:"yellow", shape:"ring", text:"runtime.norule"});
        else
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // input message listener
        this.on("input",function(msg, send) {

            // msg.request msg,dataObject not exist,empty or no rule, do nothing
            if (rules.length === 0 || !msg.request === "store" || !msg.dataObject) return;

            let rulesOn = rules.filter(rule => {
                return rule.objKey === msg.dataObject.objectKey || rule.objKey === "";
            });
            // no parameter to do
            if (!rulesOn.length) {
                // pass thru non target object ?
                if (!objFilter) send(msg);
                return;
            } 
            if (msg.dataObject.ObjectContent) {
                msg.dataObject.objectContent = msg.dataObject.ObjectContent;
                delete msg.dataObject.ObjectContent;
            };
            let contentData = msg.dataObject.objectContent.contentData;
            let dataItems = [];
            let dataItem = {};

            for (let rule of rulesOn) {

                for (let i = 0 ; i < contentData.length ; i++) {
                    // dataName dose match rule's ?
                    if (contentData[i].dataName === rule.orDataName) {
                        // make copy of oreginal dataItem, if copyFlag on
                        if (rule.reserve) dataItems.push(contentData[i]);
                        // make copy of oreginal dataItem and change dataName and push
                        dataItem = Object.assign({}, contentData[i]);
                        dataItem.dataName = rule.chDataName;
                        dataItems.push(dataItem);
                    }
                    else if (!dItemFilter) dataItems.push(contentData[i]);
                }
            }

            // delete undefined dataItem
            msg.dataObject.objectContent.contentData = dataItems;
            msg.payload = msg.dataObject.objectContent.contentData;
            // output message to the port
            send(msg);
            node.status({fill:"green", shape:"dot", text:"runtime.output"});
        }); 
    }

    RED.nodes.registerType("rename-data",renameData);
}
