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
// buffer size for ave. calculation
const MAX_BUFFER_SIZE = 1000;

module.exports = function(RED) {

    function smoothing(config) {

        RED.nodes.createNode(this, config);

        const node = this;
        // copy config properties
        const objFilter = config.objFilter;
        const params = config.params;

        let objBuffer = [];
        
        // no rule found
        if (params.length === 0)
            node.status({fill:"yellow", shape:"ring", text:"runtime.norule"});
        else
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // input message listener
        this.on("input",function(msg, send) {
            // payload not exist,empty or no rule, do nothing
            if (params.length === 0 || msg.request !== "store" || !msg.dataObject) return;

            let prms = params.filter(para => {
                return para.objectKey === msg.dataObject.objectKey || para.objectKey === "";
            });
            // no parameter to do
            if (!prms.length) {
                // pass thru non target object ?
                if (!objFilter) send(msg);
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
            let currentTime = moment(msg.dataObject.timestamp).unix();
            let contentData = msg.dataObject.objectContent.contentData;
            let range, rangeDenomi, initTime, initDenomi, value;

            for (let dItem of contentData) {
                
                value = Number(dItem.dataValue);
                // dataName or commonName dose match para's ?
                let param = prms.find(pr => { return (pr.dataName === ""
                    || dItem.dataName === pr.dataName
                    || dItem.commonName === pr.dataName)
                });
                if (!param) continue;

                range = parseInt(param.range);
                rangeDenomi = param.rangeDenomi;
                if (rangeDenomi === "min") range *= 60; 
                else if (rangeDenomi === "hour") range *= 60 * 60; 
                else if (rangeDenomi === "day") range *= 60 * 60 * 24;

                initTime = parseInt(param.initTime);
                initDenomi = param.initDenomi;
                if (initDenomi === "min") initTime *= 60; 
                else if (initDenomi === "hour") initTime *= 60 * 60; 
                else if (initDenomi === "day") initTime *= 60 * 60 * 24;

                let item = buffObj.cDataBuffer.find(elm => {
                    return elm.dataName === dItem.dataName
                });

                // dataName not exist yet, push new one
                if (!item) {
                    item = {
                        dataName: dItem.dataName,
                        start: 0,
                        current: 0,
                        sum: 0,
                        timeArray: new Array(MAX_BUFFER_SIZE),
                        dataValueArray: new Array(MAX_BUFFER_SIZE),
                    }
                    item.timeArray.fill(0);
                    item.dataValueArray.fill(0);
                    buffObj.cDataBuffer.push(item);
                }

                // interval from previous data exceed the limit ?
                else if (initTime >= 1
                    && moment(msg.dataObject.timestamp).unix() - buffObj.preTimestamp >= initTime) {
                    item.start = 0,
                    item.current = 0,
                    item.sum = 0,
                    item.timeArray.fill(0);
                    item.dataValueArray.fill(0);
                }

                // store newest data to the buffer
                item.timeArray[item.current] = currentTime;
                item.dataValueArray[item.current] = value;

                // adds the new one
                item.sum = item.sum + value;

                if (rangeDenomi !== "num") {
                    // subtracts the older than the range limit
                    while (item.timeArray[item.start] <= currentTime - range) {
                        item.sum = item.sum - item.dataValueArray[item.start];
                        if (++item.start >= MAX_BUFFER_SIZE) item.start = 0;
                    }
                }
                else {
                    // subtracts the oldeest
                    if (item.current - item.start >= range) {
                        item.sum = item.sum - item.dataValueArray[item.start];
                        if (++item.start >= MAX_BUFFER_SIZE) item.start = 0;
                    }
                }
                
                // number of data
                let num = item.current - item.start + 1;
                if (num < 0) num += MAX_BUFFER_SIZE;

                // culcurate moving ave. and set it to the dataValue
                dItem.dataValue = item.sum / num;

                // ++current pointer and over buffer size?
                if (++item.current >= MAX_BUFFER_SIZE) item.current = 0;

            }
            // store timestamp for initializing buffer interval
            buffObj.preTimestamp = moment(msg.dataObject.timestamp).unix();

            // output message to the port
            send(msg);
            node.status({fill:"green", shape:"dot", text:"runtime.output"});
        }); 
    }

    RED.nodes.registerType("smoothing",smoothing);
}

/*  各データの構造のメモ */
/*
const flag = config.flag; // "time" or "num"
const rangeTime = config.rangTime;
const rangeNum = config.rangeNum;

let param = {
    objectKey: "",
    dataName:"",
    range: 123,
    rangeDenomi: "sec",
    initTime: 123,
    initDenomi: "num"
}

let msg = {
    payload: [dataItems,],
    request: "store",
    dataObject: {
        objectType: "",
        objectKey: "",
        objectDescription: "",
        objectContent: {
            contentType: "",
            contentData: [
                {
                    dataNamwe: "",
                    dataValue: 123,
                    unit: "xx"
                },
            ]
        }

    }
}
let objBuffer = [{
    objectKey: "",
    cDataBuffer: [
        dataName: "",
        start: 0,
        current: 10,
        sum: 12345,
        timeArry: [time,],
        dataValueArray: [dataValue,],
    ],
},]
*/
