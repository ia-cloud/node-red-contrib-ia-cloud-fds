/**
 * Copyright 2025 Hiro Hashimukai on the ia-cloud project
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

const { IaCloudAPIError } = require("@ia-cloud/node-red-contrib-ia-cloud-common-nodes/ia-cloud-net-util/ia-cloud-error");

// time interval for the connection status check
const STATUSINTERVAL = 10 * 1000;

module.exports = function(RED) {

    function iaCloudCnctII(config) {
        RED.nodes.createNode(this,config);

        let node = this;

        // ia-cloud connection config node instance
        const iaCloudCnctConf = RED.nodes.getNode(config.ccsConnectionConfigII);

        // get the connection information
        let gContext = this.context().global;
        let info = gContext.get(iaCloudCnctConf.cnctInfoName);

        let statusTimerId = setInterval(function(){
            if (info.status === "Disconnected")
                node.status({fill:"blue", shape:"dot", text:"runtime.disconnected"});
            else if (info.status === "Connected")
                node.status({fill:"green", shape:"dot", text:"runtime.connected"});
        }, STATUSINTERVAL) ;

        this.on("input",function(msg) {

            //非接続状態の時は、何もしない。
            if (info.status === "Disconnected") return;
            
            if (msg.request === "store"
                || msg.request === "retrieve" || msg.request === "convey"){

                // node status をReqesting に
                node.status({fill:"blue", shape:"dot", text:"runtime.requesting"});
                info.status = "requesting";
                msg.request
                let dataObject = msg.dataObject;

                (async () => {
                    // send request
                    let res = null;
                    try {
                        node.debug(msg.request);
                        res = await iaCloudCnctConf.iaCloudCommand(msg.request, dataObject);
                        node.status({fill:"green", shape:"dot", text:"runtime.request-done"});
                        msg.payload = res;
                    } catch (error) {
                        node.status({fill:"yellow", shape:"ring", text:error.message});
                        node.error(error.message);
                        msg.payload = error.message;
                    } finally {
                        node.send(msg);
                    }
                })();
            }
        });

        this.on("close",async (done) => {

            // stop timers for the tapping
            clearInterval(statusTimerId);
            done();
        });
    }
    
    RED.nodes.registerType("ia-cloud-cnctII",iaCloudCnctII,{
        credentials: {
            userID: {type:"text"},
            password: {type: "password"}
        }
    });
}
