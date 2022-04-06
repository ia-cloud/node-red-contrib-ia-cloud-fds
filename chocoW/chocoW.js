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
const chocoWatcher = require("./choco-watcher.js");

// status read interval 10sec
const CHECK_INTERVAL = 10 * 1000
const ONEDAY = 60 * 60 * 24 * 1000

module.exports = function(RED) {

    function chocoWCtrl(config) {

        RED.nodes.createNode(this,config);

        let node = this;
        let netAddress = config.netAddress;
        let checkLoopFlag = true, checkLoopID;

        // device properties
        let dateSync = config.dateSync, triggerMode = config.triggerMode;
        let eachRecTime = config.eachRecTime, periodicRecTime= config.periodicRecTime;
        let speaker = config.speaker, angle = config.angle;

        // functionallity properties
        let storeTiming = config.storeTiming, storePeriod = parseInt(config.storePeriod) * 60 * 60;
        let capOut = config.capOut;
        let capPeriod = (config.capPeriod !== "msgOnly") ? parseInt(config.capPeriod) * 60: config.capPeriod;

        // object properties
        let objectKey = config.objectKey, objectDescription = config.objectDescription;
        let AnE = config.AnE, AnEobjectKey = config.AnEobjectKey, AnEobjectDescription = config.AnEobjectDescription;
        let status, preStatus;

        // prepare ia-cloud store object
        let msg1 = {
            request: "store",
            dataObject: {
                objectKey: "",
                objectDescription: "",
                timestamp: "",
                objectContent: {
                    contentData:[]
                }
            }
        }

        const watchr = new chocoWatcher(netAddress);

        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        // Nodeステータスを　Readyに
        node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // get camera info and set back it
        let params = {
            timestamp: dateSync ? moment().format("YYY.MM.DD HH:mm:ss") : "",
            valume: speaker !== "asis" ? speaker: "",
            recMode: triggerMode !== "asis" ? triggerMode: "",
            recDurationSD: (triggerMode === "SD" && periodicRecTime !== "asis") ? periodicRecTime: "",
            recDurationDRAM: (triggerMode === "DRAM" && eachRecTime !== "asis") ? eachRecTime: "",
            camAngle: angle !== "asis" ? angle: "",
        }

        watchr.updateChocoInfo(params)
        .then(checkLoop);

        async function checkLoop() {
            // get present time in second
            let now = moment().unix();

            // chech error
            status = await watchr.getChocoStatus();
            // if error code changed
            if (AnE && preStatus.toString() !== status.toString()) _sendAnE(status, preStatus);
            preStatus = status;

            // chech SD card
            let remainingCap = await watchr.getRemainingCapacity();
            if(remainingCap.lockFiles) {
                if (storeTiming === "each" || (storeTiming === "periodic" && now % storePeriod === 0)) {
                    let files = await watchr.getLockedFiles();
                    if (files.length > 0) _sendVideoFiles(files);
                }
            }
            if (dateSync && moment().unix % ONEDAY === 0) 
                watchr.updateCamInfo({timestamp: moment().format("YYY.MM.DD HH:mm:ss")});  

            if (capOut !== "none" && capPeriod !== "msgOnly") {
                if (now % capPeriod === 0) {
                    let image = await watchr.getImage();
                    if (capOut === "both" || capOut === "ia-cloud")
                        _sendImageFile(image);
                    if (capOut === "both" || capOut === "nodeOut")
                        _outImage(image);
                }
            }            

            // check loop
            if (checkLoopFlag) 
            checkLoopID = setTimeout(checkLoop, CHECK_INTERVAL);
        };
        
        // Send video files as ia-cloud objects
        function _sendVideoFiles(files) {
            let msgs = []
            for (let  file of files) {
                let encodedVideo = Buffer.from(file).toString("base64");
                let msg = {request: "store", dataObject: {objectType: "iaCloudObject", objectContent:{}}};
                msg.dataObject.objectKey = objectKey;
                msg.dataObject.objectDescription = objectDescription;
                msg.dataObject.timestamp = moment(file.timestamp).format();
                msg.dataObject.objectContent.contentType = "FileData"; 
                msg.dataObject.objectContent.contentData = [
                    {commonName: "File Name", dataValue: file.name},
                    {commonName: "MIME Type", dataValue:"video/quicktime"},
                    {commonName: "Encoding", dataValue: "base64"},
                    {commonName: "Size", dataValue: encodedVideo.length},
                    {commonName: "Encoded Data", dataValue: encodedVideo}
                ];
                msgs.push(msg);
            }
            node.send([msgs], ); 
        }

        // Send image file as ia-cloud objects
        function _sendImageFile(imageFile) { 
            let encodedImage = Buffer.from(imageFile.data).toString("base64");
            let msg = {request: "store", dataObject: {objectType: "iaCloudObject", objectContent:{}}};
            msg.dataObject.objectKey = objectKey;
            msg.dataObject.objectDescription = objectDescription;
            msg.dataObject.timestamp = moment(imageFile.timestamp).format();
            msg.dataObject.objectContent.contentType = "FileData"; 
            msg.dataObject.objectContent.contentData = [
                {commonName: "File Name", dataValue: imageFile.name},
                {commonName: "MIME Type", dataValue:"image/jpeg"},
                {commonName: "Encoding", dataValue: "base64"},
                {commonName: "Size", dataValue: encodedImage.length},
                {commonName: "Encoded Data", dataValue: encodedImage}
            ];
            node.send([msg, ]);
        } 
        // Send alarm&event as ia-cloud objects
        function _sendAnE(status, preStatus) { 

            let msg1 = {request: "store", dataObject: {objectType: "iaCloudObject", objectContent:{}}}
            msg1.dataObject.objectKey = AnEobjectKey;
            msg1.dataObject.objectDescription = AnEobjectDescription;
            msg1.dataObject.timestamp = moment().format();
            msg1.dataObject.objectContent.contentType = "Alarm&Event";
            msg1.dataObject.objectContent.contentData = [];

            for (key of Object.keys(status)) {

                msg1.dataObject.objectContent.contentData.push({
                    commonName: "Alarm&Event",
                    dataValue: {
                        AnEStatus: "on",
                        AnEcode: status[key],
                        AnEDescription: RED._("runtime.AnE." + status)
                    }
                })
                if (status[key] !== preStatus[key] ) AnEAtatus = "set";
            }
            node.send([msg1, ]);
        } 
        // Send image from the 2nd node output       
        function _outImage(imageFile) { 
            let msg2 = {}
            msg2.payload = imageFile.data;
            node.send([ ,msg2]);
        }

        this.on("input",function(msg) {

            if (msg.trigger) {
                watchr.setTrigger()
            }
            if (msg.getImage) {

            }

        });

        this.on("close",function() {
            checkLoopFlag = false;
            clearTimeout(checkLoopID);
        });
    }

    RED.nodes.registerType("choco-watcher",chocoWCtrl);

}
