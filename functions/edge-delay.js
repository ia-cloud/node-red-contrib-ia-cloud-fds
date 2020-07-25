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
const moment = require("moment");

module.exports = function(RED) {

    function changeDetect(config) {

        RED.nodes.createNode(this, config);

        const node = this;
        // copy config properties
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
            if (!prms) return;

            // object buffer entry exist ?
            let buffObj = objBuffer.find(elm => 
                elm.objectKey === msg.dataObject.objectKey);

            // no object in the buffer
            if (!buffObj) {
                buffObj = {
                    objectKey: msg.dataObject.objectKey,
                    cData: [],
                }
                objBuffer.push(buffObj);
            }

            let dataItems = msg.dataObject.objectContent.contentData.concat();

            for (let i = 0; i < dataItems.length; i++) {

                let dataItem = dataItems[i];
                // dataName or commonName dose match para's ?
                let prm = prms.find(pr => { return (pr.dataName === ""
                    || dataItem.dataName === pr.dataName
                    || dataItem.commonName === pr.dataName)
                });
                if (!prm) continue;

                // preData already in buffer ?
                let item = buffObj.cData.find(elm => {
                    return elm.dataName === dataItem.dataName
                });

                // dataName not exist yet, push new one
                if (!item) {
                    item = {
                        dataName: dataItem.dataName,
                        preValue: !dataItem.dataValue,
                        coseqOn: 1,
                        coseqOff: 1
                    }
                    if (dataItem.dataValue) item.coseqOn = prm.ondelay;
                    else item.coseqOff = prm.offdelay;
                    buffObj.cData.push(item);
                }

                // is data same as the previous data
                let result = (dataItem.dataValue === item.preValue);

                if (!result) {
                    // on edge
                    if (dataItem.dataValue) {  
                        // on delay 
                        if (item.coseqOn >= prm.ondelay) {
                            item.preValue = dataItem.dataValue;
                            item.coseqOn = 1;
                        } else {
                            item.coseqOn++;
                            dataItems[i] = {};      // nochange no dataItem
                        }
                    } 
                    // off edge
                    else{
                        // off delay 
                        if (item.coseqOff >= prm.offdelay) {
                            item.preValue = dataItem.dataValue;
                            item.coseqOff = 1;
                        } else {
                            item.coseqOff++;
                            dataItems[i] = {};      // nochange no dataItem
                        }
                    } 
                }
                // nochange no dataItem
                else dataItems[i] = {};
            }

            // get "dataItem == {}" filtered
            dataItems = dataItems.filter(item => {return item.hasOwnProperty("dataName")});

            if (dataItems.length !== 0) {
                // output message to the port
                msg.dataObject.objectContent.contentData = dataItems;
                msg.payload = dataItems;
                send(msg);
                node.status({fill:"green", shape:"dot", text:"runtime.output"});
            } else {
                node.status({fill:"green", shape:"ring", text:"runtime.nomatch"});
            }
        }); 
    }

    RED.nodes.registerType("change-detect",changeDetect);
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
    cData: [{
        dataName: "",
        cosqecOn: 0,
        coseqOff: 0
    },]
},]
*/
