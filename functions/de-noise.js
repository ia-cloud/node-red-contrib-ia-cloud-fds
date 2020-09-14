
"use strict";
const moment = require("moment");

module.exports = function(RED) {

    function deNoise(config) {

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

            let param = params.find(para => {
                return para.objectKey === msg.dataObject.objectKey || para.objectKey === "";
            });
            if (!param) return;

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

            if (typeof param.interval === "number" && param.interval !== 0){
                if (moment(msg.dataObject.timestamp).unix() - buffObj.preTimestamp >= param.interval) {
                    buffObj.preTimestamp = msg.dataObject.timestamp;
                    return;
                }
            }

            let dataItems = msg.dataObject.objectContent.contentData.concat();
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
                let disp = Math.abs(dataItems[i].dataValue - item.preValue);

                // store dataValue as a previous data
                item.preValue = dataItems[i].dataValue;

                // check the displacement
                if (disp > param.disp) dataItems[i] = {};
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
