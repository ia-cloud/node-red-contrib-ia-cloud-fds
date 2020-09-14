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

const BASH_INTERVAL = 700;
const readline = require('readline');

module.exports = function(RED) {

    function caliperMtoyo(config) {

        RED.nodes.createNode(this, config);

        const node = this;

        let dataItems = [];
        let dataParams = config.dataParams;
        let length = dataParams.length;
        let bashCount = 0;
        let itemCount = 0;
        let timeoutId = undefined;

        // Nodeステータスを　Readyに
        node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        const rl = readline.createInterface({input: process.stdin, });

        // readLine from standerd input
        rl.on("line",(data) => {
            // parse measured data
            let measuredData = Number(data.toString("ascii", 0, data.lenghth - 1));

            // detects bashing a button 
            if (bashCount === 0) {
                timeoutId = setTimeout(function(){storeData(measuredData)}, BASH_INTERVAL);
                bashCount++;
            }
            else if (bashCount <= 3) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(function(){storeData(measuredData)}, BASH_INTERVAL);
                bashCount++;
            }
        });

        // after bash interval, take action to store data
        let storeData = function (data) {
            // define data item object
            let dataItem = {
                dataName: "",
                dataValue: 999.99,      // dummy data value
                nuit: "mm"
            }
            let msg = {};
            // push dataItem to dataItem array
            if (bashCount === 1 && itemCount < length) {
                dataItem.dataName = dataParams[itemCount].dataName;
                dataItem.dataValue = data;
                dataItems.push(dataItem);
                itemCount++; 
                // Send dataItem to message.payload
                msg.payload = dataItem;
                node.send(msg);
                node.status({fill:"green", shape:"dot", text: dataItem.dataName + ": " + data.toFixed(2)});
            // bash button twice for message out         
            } else if (bashCount === 2){
                bashCount = 0;
                itemCount = 0;
                dataItems = iaCloudObjectSend(dataItems);
            // bash button three times for clear all data
            } else if (bashCount >= 3){
                bashCount = 0;
                itemCount = 0;
                dataItems = [];
                // Send dataItem to message.payload
                msg.payload = dataItems;
                node.send(msg);
                node.status({fill:"green", shape:"ring", text: "runtime.reset"});
            }
            bashCount = 0;
        }
    
        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして送出する関数
        let iaCloudObjectSend = function (dataItems) {

            const moment = require("moment");
    
            node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});
    
            let msg = {request:"store", dataObject:{objectContent:{}}};
    
            msg.dataObject.objectKey = config.objectKey;
            msg.dataObject.timestamp = moment().format();
            msg.dataObject.objectType = "iaCloudObject";
            msg.dataObject.objectDescription = config.objectDescription;
            msg.dataObject.objectContent.contentType = config.contentType;

            let contentData = [];
            dataItems.forEach(dItem => {
                contentData.push(Object.assign({}, dItem));
            });
    
            msg.dataObject.objectContent.contentData = contentData;
            // set contentData[] to msg.payload
            msg.payload = contentData;
            // Send output message to the next Nodes
            node.send(msg);
            // make Node status to "sent"
            node.status({fill:"green", shape:"dot", text:"runtime.sent"});

            return [];
        }


        this.on("input",function(msg) {
            if (msg.payload === "send") {
                bashCount = 0;
                itemCount = 0;
                iaCloudObjectSend(dataItems);
            } else if (msg.payload === "reset"){
                bashCount = 0;
                itemCount - 0;
                dataItems = [];
            }
        });
        this.on("close",function(done) {
            port.close(done);
        });
    };

    RED.nodes.registerType("caliper-Mitsutoyo",caliperMtoyo);
}
