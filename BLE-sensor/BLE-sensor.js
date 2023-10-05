/**
 * Copyright 2022 Hiro Hashimukai on the ia-cloud project
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

    function BLESensor(config) {

        RED.nodes.createNode(this,config);

        let node = this;
        let items = config.dataItems;
        let myObjKey = config.objectKey;
        let sensorId = config.sensorId;
        let propertyId = config.propertyId;
        let propertyData = config.propertyData;
        let propertyRssi = config.propertyRssi;

        let preBuffer = Buffer.alloc(0);

        // Nodeステータスを Readyに
        node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        this.on("input",function(msg) {

            const getMsgProperty = (msg, propertyPath ) => {
                let value = msg;
                let propNames = propertyPath.split(".");
                for (let propName of propNames) {
                    if (!value.hasOwnProperty(propName)) return undefined;
                    value = value[propName];
                }
                return value;
            }
            let rssi;
            let dataPacket = [];

            if (sensorId !== getMsgProperty(msg, propertyId)) return;
            dataPacket = getMsgProperty(msg, propertyData);
            if (!dataPacket) {
                node.status({fill:"green", shape:"dot", text:"runtime.nomatch"});
                return
            };
            rssi = getMsgProperty(msg, propertyRssi);
            
            let buffer = Buffer.from(dataPacket);
            if (preBuffer.compare(buffer) === 0) {
                node.status({fill:"green", shape:"dot", text:"runtime.nochange"});
                return
            };
            preBuffer = buffer;

            let outMsg = {request:"store", dataObject:{objectContent:{contentData:[],}}};

            for (let item of items) {

                let dItem = {
                    dataName: item.dataName,
                    dataValue: null,
                    unit: item.unit
                };

                let posi = parseInt(item.posi);
                switch (item.type) {
                    case "1B":
                        if (posi < buffer.length) 
                            dItem.dataValue = item.sign === "signed" ? buffer.readInt8(posi): buffer.readUInt8(posi);
                        break;
                    case "2LE":
                        if (posi + 1 < buffer.length) 
                            dItem.dataValue = item.sign === "signed" ? buffer.readInt16LE(posi): buffer.readUInt16LE(posi);
                        break;
                    case "2BE":
                        if (posi + 1 < buffer.length) 
                            dItem.dataValue = item.sign === "signed" ? buffer.readInt16BE(posi): buffer.readUInt16BE(posi);
                        break;
                    case "4LE":
                        if (posi + 3 < buffer.length) 
                            dItem.dataValue = item.sign === "signed" ? buffer.readInt32LE(posi): buffer.readUInt32LE(posi);
                        break;
                    case "4BE":
                        if (posi + 3 < buffer.length) 
                            dItem.dataValue = item.sign === "signed" ? buffer.readInt32BE(posi): buffer.readUInt32BE(posi);
                        break;
                    default:
                }
                dItem.dataValue = dItem.dataValue * Number(item.gain) + Number(item.offset);
                outMsg.dataObject.objectContent.contentData.push(dItem);
            }
            if (rssi) {
                outMsg.dataObject.objectContent.contentData.push({
                dataName: "rssi",
                dataValue: rssi,
                unit: "dBm"
            });
            }
           
            outMsg.dataObject.objectKey = myObjKey;
            outMsg.dataObject.timestamp = moment().format();
            outMsg.dataObject.objectType = "iaCloudObject";
            outMsg.dataObject.objectDescription = config.objectDescription;
            outMsg.dataObject.objectContent.contentType = config.contentType;
            node.send(outMsg);
            node.status({fill:"green", shape:"dot", text:"runtime.sent"});
        });
    }

    RED.nodes.registerType("BLE-sensor",BLESensor);

}
