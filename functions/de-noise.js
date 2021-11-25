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

    function deNoise(config) {

        RED.nodes.createNode(this, config);

        const node = this;
        // copy config properties
        const params = config.params;
        const objFilter = config.objFilter;
        const objFlag = config.objFlag;
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
                if (!objFilter) {
                    send(msg);
                }
                return;
            } 

            // object buffer entry exist ?
            let buffObj = objBuffer.find(elm => 
                elm.objectKey === msg.dataObject.objectKey);

            // no object in the buffer
            if (!buffObj) {
                buffObj = {
                    objectKey: msg.dataObject.objectKey,
                    preTimestamp: moment(msg.dataObject.timestamp).unix(),
                    cData: [],
                }
                objBuffer.push(buffObj);
            }

            let dataItems = msg.dataObject.objectContent.contentData.concat();
            for (let j = 0; j < prms.length; j++) {

                let param = prms[j];

                if (typeof param.interval === "number" && param.interval !== 0){
                    if (moment(msg.dataObject.timestamp).unix() - buffObj.preTimestamp >= param.interval) {
                        buffObj.preTimestamp = msg.dataObject.timestamp;
                        return;
                    }
                }
                for (let i = 0; i < dataItems.length; i++) {

                    // dataName dose't match para's
                    if (param.dataName !== "" && dataItems[i].dataName !== param.dataName) continue;

                    // preData already in buffer ?
                    let item = buffObj.cData.find(elm => {
                        return elm.dataName === dataItems[i].dataName
                    });

                    // dataName not exist yet, push new one
                    if (!item) {
                        item = {
                            dataName: dataItems[i].dataName,
                            preValue: dataItems[i].dataValue,
                        }
                        buffObj.cData.push(item);
                    }

                    // displacement from the previous data
                    let disp = (dataItems[i].dataValue - item.preValue);

                    // check the displacement
                    if (disp > param.plusDisp || disp < -param.minusDisp) {
                        dataItems[i] = {};
                        // invalid whole object?
                        if (objFlag === true) dataItems.length = 0;
                    }
                    else {
                        // store dataValue as a previous data
                        item.preValue = dataItems[i].dataValue;
                    }
                }
            }

            // store timestamp for initializing buffer interval
            buffObj.preTimestamp = moment(msg.dataObject.timestamp).unix();

            // get "dataItem == {}" filtered
            dataItems = dataItems.filter(item => {return item.hasOwnProperty("dataName")});

            if (dataItems.length !== 0) {
                // output message to the port
                msg.dataObject.objectContent.contentData = dataItems;
                msg.payload = dataItems;
                send(msg);
                node.status({fill:"green", shape:"dot", text:"runtime.output"});
            }else {
                node.status({fill:"green", shape:"ring", text:"runtime.nomatch"});
            }
        }); 
    }

    RED.nodes.registerType("de-noise",deNoise);
}

/*  各データの構造のメモ */
/*
let param = {
    objectKey: "",
    disp: 123,
    interval: 123
}
let params = [param,];

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
    preTimestamp: 0,
    cData: [{
        dataName: "",
        preValue: dataValue,
    },]
},]
*/
