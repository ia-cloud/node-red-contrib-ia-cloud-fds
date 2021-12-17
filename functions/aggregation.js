/**
 * Copyright 2019 Hiro Hashimukai for the ia-cloud project
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
// buffer size for ave. calculation
const MAX_BUFFER_SIZE = 1000;

module.exports = function(RED) {

    function aggregation(config) {

        RED.nodes.createNode(this, config);

        const node = this;
        // copy config properties
        const objectKey = config.objectKey;
        const objectDescription = config.objectDescription;
        const period = config.aggPeriod;
 
        const contentType = config.contentType;
        const params = config.params;
        const progOut = config.progOut;

        let objBuffer = [];
        
        // no rule found
        if (params.length === 0)
            node.status({fill:"yellow", shape:"ring", text:"runtime.norule"});
        else
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // function to make aggregation
        let aggre = function() {
            // contentData for aggregation data 
            let contentData = [];

            for (let prm of params) {
                //  objectKey and dataName match ?
                let cBuff = objBuffer.find(elm => elm.objectKey === prm.objectKey)
                if (!cBuff) continue;
                let iBuff = cBuff.cDataBuffer.find(elm => elm.dataName === prm.dataName)
                if (!iBuff) continue;
                let buff = iBuff.dataValueArray;
                // still no data in buffer
                if (buff.length === 0) continue;
                let value;
                switch (prm.aggMode) {
                    case "count":
                        value = buff.length;
                        break;
                    case "sum":
                    case "ave":
                    case "var":
                    case "stdev":
                        // get summention
                        value = buff.reduce((sum, elm) => sum + elm);
                        if (prm.aggMode === "sum") break;
                        // get average
                        value = buff.reduce((sum, elm) => sum + elm) / buff.length;
                        if (prm.aggMode === "ave") break;
                        // culculate variance and standerd deviation
                        let ave = value;
                        value = buff.map((current) => {
                            return ((current - ave) ** 2);
                        }).reduce((curr, next) => curr + next) / buff.length;
                        if (prm.aggMode === "var") break;
                        value = Math.sqrt(value)
                        break;
                    case "max":
                        value = buff.reduce((min, elm) => (min < elm)? elm: min);
                        break;
                    case "min":
                        value = buff.reduce((min, elm) => (min > elm)? elm: min);
                        break;
                    case "med":
                        // get median
                        let half = (buff.length / 2) | 0;
                        buff.sort((curr, next) => curr - next);
                        if (buff.length % 2) value = buff[half];
                        else value = (buff[half - 1] + buff[half]) / 2;
                        break;                      
                    default:
                }
                contentData.push({
                    dataName: prm.aggdName,
                    dataValue: value,
                    unit: prm.aggUnit
                });
            }
            // make output message and send
            if (!contentData.lenght) {

                let msg = {request:"store", dataObject:{objectContent:{}}};
                msg.dataObject.objectContent.contentData = contentData;
                msg.dataObject.objectKey = objectKey;
                msg.dataObject.timestamp = moment().format();
                msg.dataObject.objectType = "iaCloudObject";
                msg.dataObject.objectDescription = objectDescription;
                msg.dataObject.objectContent.contentType = contentType;
                msg.payload = msg.dataObject.objectContent.contentData;
    
                node.send(msg);
                node.status({fill:"green", shape:"dot", text:"runtime.sent"});
            }
            return;
        }

        let intervalId = setInterval(function(){

            // get current time
            let currentTime = moment();
            //check minute end
            if (currentTime.second() !== 59 ) return;
            // 10 minute2 ?
            if (period === "10min" && currentTime.minute() % 10 !== 9) return;
            // 30 mminutes
            if (period === "30min" && currentTime.minute() % 30 !== 29) return;
            if (period !== "1min" && period !== "10min" && period !== "30min") {
                // hour end ?
                if (currentTime.minute() !== 59) return;
                // 12 hour ?
                if (period === "12hour" && currentTime.hour() % 12 !== 11) return;
                // day end ?
                if (period === "1day" || period === "1week" || period === "1mon") {
                    if (currentTime.hour() !== 23) return;
                    if (period === "1week" && currentTime.day() !== 6) return;
                    if (period === "1mon" && currentTime.date() !== currentTime.endOf("month").date()) return;
                }
            }
            // period end, make aggregation and send message
            aggre();
            // clear arregation data buffer
            objBuffer.length = 0;
            return;

        }, 1000);

        // input message listener
        this.on("input",function(msg, send) {
            // payload not exist,empty or no rule, do nothing
            if (params.length === 0 || msg.request !== "store" || !msg.dataObject) return;

            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

            let prms = params.filter(para => {
                return para.objectKey === msg.dataObject.objectKey;
            });
            // no parameter to do
            if (!prms.length) {
                // pass thru non target object ?
                return;
            } 

            // object buffer entry exist ?
            let buffObj = objBuffer.find(elm => 
                elm.objectKey === msg.dataObject.objectKey);

            // no object in the buffer
            if (!buffObj) {
                buffObj = {
                    objectKey: msg.dataObject.objectKey,
                    cDataBuffer: []
                }
                objBuffer.push(buffObj);
            }
            let contentData = msg.dataObject.objectContent.contentData;
            let value;

            for (let dItem of contentData) {
                
                value = Number(dItem.dataValue);
                // dataName or commonName dose match para's ?
                let param = prms.find(pr => { return (
                    dItem.dataName === pr.dataName || dItem.commonName === pr.dataName)
                });
                if (!param) continue;

                let item = buffObj.cDataBuffer.find(elm => {
                    return elm.dataName === dItem.dataName
                });

                // dataName not exist yet, push new one
                if (!item) {
                    item = {
                        dataName: dItem.dataName,
                        dataValueArray: [],
                    }
                    item.dataValueArray.fill(0);
                    buffObj.cDataBuffer.push(item);
                }
                // store newest data to the buffer
                if (!item.dataValueArray.length <= MAX_BUFFER_SIZE) item.dataValueArray.push(value);
                else node.status({fill:"yellow", shape:"dot", text:"runtime.buffOver"});
            }
            // if progress output
            if (progOut) aggre();
        }); 

        this.on("close",function(done) {
            clearInterval(intervalId);
            done();
        });
    }

    RED.nodes.registerType("aggregation",aggregation);
}
