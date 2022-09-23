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

    function renameObject(config) {

        RED.nodes.createNode(this,config);
        const node = this;
        const objFilter = config.objFilter;
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

            let objectKey = msg.dataObject.objectKey;
            if (objFilter) msg.dataObject.objectKey = "";
            for (let rule of rules) {
                if (rule.orObjectKey === objectKey) {
                    msg.dataObject.objectKey = rule.chObjectKey;
                    break;
                }
            }
            // output message to the port
            if (msg.dataObject.objectKey) {
                send(msg);
                node.status({fill:"green", shape:"dot", text:"runtime.output"});
            }
        }); 
    }

    RED.nodes.registerType("rename-object",renameObject);
}
