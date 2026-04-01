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
const {format} = require("date-fns");

const DATAPATH = "payload.advertisement.manufacturerData";
const RSSIPATH = "payload.rssi";
const DATAPATHLENGTH = 25;
const MIN1 = 1000 * 60;  // 1000ms * 60sec * 1min
const MIN10 = 1000 * 60 * 10;  // 1000ms * 60sec * 10min
const MIN30 = 1000 * 60 * 30;  // 1000ms * 60sec * 30min

module.exports = function(RED) {

    function SiRCSensor(config) {

        RED.nodes.createNode(this,config);

        const node = this;
        const items = config.dataItems;
        const myObjKey = config.objectKey;
        const sensorId = parseInt(config.sensorId);
        const period = config.period;
        const sensorType = config.sensoeType;
        const voltage = (sensorType === "s100") ? 100:
                        (sensorType === "s200" || sensorType === "t200") ? 200: 400;

        let preBuffer = Buffer.alloc(0);
        let preDemnd = undefined;
        let preTime1m = (Math.floor(new Date().getTime() / MIN1) * MIN1) - MIN10;
        let preTime10m = (Math.floor(preTime1m / MIN10) * MIN10) - MIN10;
        let preTime30m = (Math.floor(preTime10m / MIN30) * MIN30) - MIN30;

        // set node status to "Ready"
        node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        this.on("input",function(msg) {

            const getMsgProperty = (msg, propertyPath) => {
                if (!msg || typeof propertyPath !== 'string') return undefined;

                // パスを . と [...] で分割する正規表現
                const regex = /[^.\[\]]+|\[(\d+)\]/g;
                const keys = [];
                let match;
                while ((match = regex.exec(propertyPath)) !== null) {
                    // match[1] に数字（配列インデックス）があれば数値として扱う
                    keys.push(match[1] !== undefined ? Number(match[1]) : match[0]);
                }

                let current = msg;
                for (const key of keys) {
                    if (current && key in current) {
                    current = current[key];
                    } else {
                    return undefined;
                    }
                }
                return current;
            }
            // get data packet payload of the BLE advertisement
            let dataPacket = getMsgProperty(msg, DATAPATH);
            if (!dataPacket) return;

            const dataPacketBuff = Buffer.from(dataPacket);
            // SiRC sennsor's payload has to have the length of 25
            if (dataPacketBuff.length > DATAPATHLENGTH) return;

            // check the company identification code of SiRC
            if (dataPacketBuff.readInt16LE(0) !== 0x08bf) return;

            //get the sensor ID number and chech
            if (sensorId !== (dataPacketBuff[5] <<16 | dataPacketBuff[6] << 8 | dataPacketBuff[7]) ) return;

            // keep the previous packet content
            if (dataPacketBuff.equals(preBuffer)) return;
            preBuffer = dataPacketBuff;
            
            let rssi = getMsgProperty(msg, RSSIPATH);

            // read sensor data 
            let kWH = dataPacketBuff.readUInt32BE(8);
            let kW = dataPacketBuff[12] << 16 | dataPacketBuff[13] << 8 | dataPacketBuff[14];
            let kVA = dataPacketBuff[15] << 16 | dataPacketBuff[16] << 8 | dataPacketBuff[17];
            let alm = dataPacketBuff[23];
            let batt = dataPacketBuff[24];

            const now = new Date();
            const nowTime = now.getTime();
            
            if (period !== "sensor") {
                switch (period) {
                    case "1m":
                        if (nowTime - preTime1m <= MIN1) return;
                        preTime1m = Math.floor(nowTime / MIN1) * MIN1;
                        break;
                    case "10m":
                        if (nowTime - preTime10m <= MIN10) return;
                        preTime10m = Math.floor(nowTime / MIN10) * MIN10;
                        break;
                    case "30m":
                        if (nowTime - preTime30m <= MIN30) return;
                        break;
                    default:
                        return;
                }
            }

            // create an output message
            let outMsg = {request:"store", dataObject:{objectContent:{contentData:[],}}};

            for (let item of items) {

                let dItem = {
                    dataName: item.dataName,
                    dataValue: null,
                    unit: item.unit
                };
                switch (item.item) {
                    case "kWH": dItem.dataValue = kWH;
                        break;
                    case "kW": dItem.dataValue = kW;
                        break;
                    case "dmnd": if (!preDemnd) preDemnd = kWH; // the first time after deploy
                        dItem.dataValue = (kWH - preDemnd);
                        // when wrapped around
                        dItem.dataValue = dItem.dataValue >= 0 ? dItem.dataValue: dItem.dataValue + 0xffffffff;
                        dItem.dataValue = dItem.dataValue * 2 * MIN30 / (nowTime  - preTime30m);
                        break;
                    case "kVA": dItem.dataValue = kVA;
                        break;
                    case "A": dItem.dataValue = kVA / voltage;
                        break;
                    case "PF": dItem.dataValue = (kVA !== 0 ? kW/kVA: undefined);
                        break;
                    case "RSSI": dItem.dataValue = rssi;
                        break;
                    case "ALM": dItem.dataValue = alm;
                        break;
                    case "BATT": dItem.dataValue = 3.3 * batt / 255;
                        break;                                             
                    default:
                }
                outMsg.dataObject.objectContent.contentData.push(dItem);
            }
            if (nowTime - preTime30m > MIN30) {
                preTime30m = Math.floor(nowTime / MIN30) * MIN30;
                preDemnd = kWH;
            }
            outMsg.dataObject.objectKey = myObjKey;
            outMsg.dataObject.timestamp =  format(now, "yyyy-MM-dd'T'HH:mm:ssXXX");
            outMsg.dataObject.objectType = "iaCloudObject";
            outMsg.dataObject.objectDescription = config.objectDescription;
            outMsg.dataObject.objectContent.contentType = config.contentType;
            outMsg.payload = outMsg.dataObject;
            node.send(outMsg);
            node.status({fill:"green", shape:"dot", text:"runtime.sent"});
        });
    }

    RED.nodes.registerType("SiRC-sensor",SiRCSensor);

}
