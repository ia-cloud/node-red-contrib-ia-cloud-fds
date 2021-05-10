
"use strict";
const moment = require("moment");

// buffer size for ave. calculation
const MAX_BUFFER_SIZE = 1000;

module.exports = function(RED) {

    function deNoise2(config) {

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
            let contentData = msg.dataObject.objectContent.contentData.concat();
            let range, rangeDenomi, disp, limit, value;

            for (let i = 0; i < contentData.length; i++) {
                let dItem = contentData[i];
                value = Number(dItem.dataValue);
                // dataName or commonName dose match para's ?
                let param = prms.find(pr => { return (pr.dataName === ""
                    || dItem.dataName === pr.dataName
                    || dItem.commonName === pr.dataName)
                });
                if (!param) continue;

                limit = Number(param.limit);
                range = parseInt(param.range);
                rangeDenomi = param.rangeDenomi;
                if (rangeDenomi === "min") range *= 60; 
                else if (rangeDenomi === "hour") range *= 60 * 60; 
                else if (rangeDenomi === "day") range *= 60 * 60 * 24;

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

                // store newest data to the buffer
                item.timeArray[item.current] = currentTime;
                item.dataValueArray[item.current] = value;

                // adds the new one
                item.sum = item.sum + value;

                // subtracts the older than the range limit
                while (item.current !== 0 
                    && item.timeArray[item.start] <= currentTime - range) {
                    item.sum = item.sum - item.dataValueArray[item.start];
                    if (++item.start >= MAX_BUFFER_SIZE) item.start = 0;
                }

                // number of data
                let num = item.current - item.start + 1;
                if (num < 0) num += MAX_BUFFER_SIZE;

                // culcurate displacement from average
                disp = Math.abs(value - (item.sum / num));

                // if disp over the limit, discard the Item
                if (disp > limit)  contentData[i] = {};

                // ++current pointer and over buffer size?
                if (++item.current > MAX_BUFFER_SIZE) item.current = 0;

            }
            // store timestamp for initializing buffer interval
            buffObj.preTimestamp = moment(msg.dataObject.timestamp).unix();

            // get "dataItem == {}" filtered
            contentData = contentData.filter(item => {return item.hasOwnProperty("dataName")});

            if (contentData.length !== 0) {
                // output message to the port
                msg.dataObject.objectContent.contentData = contentData;
                msg.payload = contentData;
                send(msg);
                node.status({fill:"green", shape:"dot", text:"runtime.output"});
            }else {
                node.status({fill:"green", shape:"ring", text:"runtime.nomatch"});
            }
        }); 
    }

    RED.nodes.registerType("de-noise2",deNoise2);
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
    limit: 123
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

