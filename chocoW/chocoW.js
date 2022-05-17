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
const fs = require("fs");
const {Base64Encode} = require("base64-stream");
const chocoWatcher = require("./choco-watcher.js");
const path = require("path");

// status read interval 10sec
const CHECK_INTERVAL = 10 * 1000
const ONEDAY = 60 * 60 * 24 * 1000
// directory name for temp files store
const TEMPDIRNAME = "temp-dir-ia-cloud/";
const TEMPIMAGEFILENAME = "choco-live.jpg";

module.exports = function(RED) {

    function chocoWCtrl(config) {

        RED.nodes.createNode(this,config);

        let node = this;
        let netAddress = config.netAddress;
        let checkLoopFlag = true, checkLoopID;

        // device properties of Choco Watcher
        let dateSync = config.dateSync, triggerMode = config.triggerMode;
        let eachRecTime = config.eachRecTime, periodicRecTime= config.periodicRecTime;
        let speaker = config.speaker, angle = config.angle;

        // functionallity properties of Choco Watcher
        let storeTiming = config.storeTiming, storePeriod = parseInt(config.storePeriod) * 60 * 60;
        let capOut = config.capOut;
        let capPeriod = (config.capPeriod !== "msgOnly") ? parseInt(config.capPeriod) * 60: config.capPeriod;

        // ia-cloud object properties
        let objectKey = config.objectKey, objectDescription = config.objectDescription;
        let AnE = config.AnE, AnEobjectKey = config.AnEobjectKey, AnEobjectDescription = config.AnEobjectDescription;
        let status, preStatus;

        const watchr = new chocoWatcher(netAddress);

        // node status preparing
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        // temp directory refresh -- node.js 12 or later
        fs.rmdirSync(TEMPDIRNAME, {recursive: true});

        // preparing camera info
        let params = {
            timestamp: dateSync ? moment().format("YYYY.MM.DD HH:mm:ss") : "",
            valume: speaker !== "asis" ? speaker: "",
            recMode: triggerMode !== "asis" ? triggerMode: "",
            recDurationSD: (triggerMode === "SD" && periodicRecTime !== "asis") ? periodicRecTime: "",
            recDurationDRAM: (triggerMode === "DRAM" && eachRecTime !== "asis") ? eachRecTime: "",
            camAngle: angle !== "asis" ? angle: "",
        }

        node.status({fill:"green", shape:"dot", text:"runtime.ready"});
        try {
            // get camera info and set back it
            watchr.updateChocoInfo(params)
            .then(watchr.setCamMode("rec")) 
            .then(watchr.startRecMovie())            
            // and get to check loop in
            .then(checkLoop);
        }
        catch (error) {
            node.status({fill:"yellow", shape:"ring", text:"chocoWHttpError"});
            node.warn(error.toString());
        }
    
        // loop function
        async function checkLoop() {
            // get present time in second
            let now = moment().unix();

            // node status Ready
            await watchr.setCamMode("rec");
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

            // chech choco watcher status
            status = await watchr.getChocoStatus();
            // if error code changed
            if (AnE && preStatus.toString() !== status.toString()) _sendAnE(status, preStatus);
            preStatus = status;

            // check SD card
            let remainingCap = await watchr.getRemainingCapacity();
            if(remainingCap.lockFiles !== "0") {
                if (storeTiming === "each" || (storeTiming === "periodic" && now % storePeriod === 0)) {
                    node.status({fill:"green", shape:"dot", text:"runtime.geting-v-files"});
                    let files = await watchr.getLockedFiles();
                    if (files.length > 0) _sendVideoFiles(files);
                }
            }
            if (dateSync && moment().unix % ONEDAY === 0) 
                await watchr.updateCamInfo({timestamp: moment().format("YYY.MM.DD HH:mm:ss")});  

            if (capOut !== "none" && capPeriod !== "msgOnly") {
                if (now % capPeriod <= 10) {
                    node.status({fill:"green", shape:"dot", text:"runtime.geting-i-files"});
                    const filePath = await watchr.getCamImage();
                    if (capOut === "both" || capOut === "ia-cloud")
                        _sendImageFile(filePath);
                    if (capOut === "both" || capOut === "nodeOut"){
//                        let pl = fs.readFileSync(filePath).toString("base64");
                        node.send([, {
                            payload: `
                            <html>
                            <body>
                                <img src="/choco-live.jpg?${now}" width="100%">                          
                            </body>
                            </html>
                            `
                        }]); 
                    }
                }
            }            

            // check loop
            if (checkLoopFlag) 
            checkLoopID = setTimeout(checkLoop, CHECK_INTERVAL);
        };
        
        // Send video files as ia-cloud objects
        async function _sendVideoFiles(files) {

            let msgs = [];
            let filePathB64;
            for (let i = 0; i < files.length; i++) {
                // if no file exist, just through to next
                if (!fs.existsSync(files[i].filePath)) continue;
                
                // make unique file name for locked video file
                filePathB64 = "ChocoW-video_" +  moment(files[i].endTime).format("YYYYMMDD[T]HHmmss") + ".mov.b64";

                // Promisify
                await new Promise((resolve, reject) => {
                    // read stream
                    const rs = fs.createReadStream(files[i].filePath);
                    // base64 encoding stream
                    const b64s = new Base64Encode();
                    // write stream
                    const ws = fs.createWriteStream(TEMPDIRNAME + filePathB64);

                    // connecting each stram with pipe
                    rs.pipe(b64s).pipe(ws);
            
                    // Write Stream finished ?
                    ws.on('finish', () => {
                        resolve();
                    });
                    ws.on("error",(err) => {
                        reject(err);
                    })
                });
                // remove original .mov file
                fs.unlinkSync(files[i].filePath);

                // preparing node output message of ia-cloud object
                let msg = {request: "store", dataObject: {objectType: "iaCloudObject", objectContent:{}}};
                msg.dataObject.objectKey = objectKey;
                msg.dataObject.objectDescription = objectDescription;
                msg.dataObject.timestamp = moment(files[i].endTime).format();
                msg.dataObject.objectContent.contentType = "Filedata"; 
                msg.dataObject.objectContent.contentData = [
                    {commonName: "File Name", dataValue: filePathB64},
                    {commonName: "MIME Type", dataValue:"video/quicktime"},
                    {commonName: "Encoding", dataValue: "base64"},
                    {commonName: "Size", dataValue: fs.statSync(TEMPDIRNAME + filePathB64).size},
                    {commonName: "file path", dataValue: TEMPDIRNAME + filePathB64} 
                ];
                msgs.push(msg);
            }
            node.send([msgs, ]); 
            node.status({fill:"green", shape:"dot", text:"runtime.v-file-sent"});


        }

        // Send image file as ia-cloud objects
        async function _sendImageFile(imageFile) { 
            
            // if the file not exist, just through out
            if (!fs.existsSync(imageFile)) return;
            // make unique file name for locked video file
            let filePathB64 = "ChocoW-image_" +  moment().format("YYYYMMDD[T]HHmmss") + ".jpg.b64";
            
            // promisify
            await new Promise((resolve, reject) => {   

                const rs = fs.createReadStream(imageFile);
                const b64s = new Base64Encode();
                const ws = fs.createWriteStream(TEMPDIRNAME + filePathB64);
                // connect each stream with pipe
                rs.pipe(b64s).pipe(ws);
        
                // Write Stream finished ?
                ws.on('finish', () => {
                    resolve();
                });
                ws.on("error",(err) => {
                    reject(err);
                })
            });
            
            // preparing node output message of ia-cloud object
            let msg = {request: "store", dataObject: {objectType: "iaCloudObject", objectContent:{}}};
            msg.dataObject.objectKey = objectKey;
            msg.dataObject.objectDescription = objectDescription;
            msg.dataObject.timestamp = moment(fs.statSync(imageFile).timestamp).format();
            msg.dataObject.objectContent.contentType = "Filedata"; 
            msg.dataObject.objectContent.contentData = [
                {commonName: "File Name", dataValue: filePathB64},
                {commonName: "MIME Type", dataValue:"image/jpeg"},
                {commonName: "Encoding", dataValue: "base64"},
                {commonName: "Size", dataValue: fs.statSync(TEMPDIRNAME + filePathB64).size},
                {commonName: "file path", dataValue: TEMPDIRNAME + filePathB64}
            ];
            node.send([msg, ]);
            node.status({fill:"green", shape:"dot", text:"runtime.i-file-sent"});
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
            node.status({fill:"green", shape:"dot", text:"runtime.Alarm-sent"});
        } 
        
        // Send image from the 2nd node output       
        function _outImage(imageFile) { 
            node.send([ ,{payload: imageFile}]);
            node.status({fill:"green", shape:"dot", text:"runtime.i-file-sent"});
        }

        // input mesaage event handler
        this.on("input",function(msg) {
            (async () => {
                // if trigger input to choco Watcher
                if (msg.trigger) {
                    await watchr.setTrigger()
                    node.status({fill:"green", shape:"dot", text:"runtime.trigger"});
                }
                // if getting live image file
                if (msg.getImage) {
                    const filePath = await watchr.getCamImage();
                    if (capOut === "both" || capOut === "ia-cloud")
                        _sendImageFile(filePath);
                    if (capOut === "both" || capOut === "nodeOut"){
//                        let pl = fs.readFileSync(filePath).toString("base64");
                        let now = moment().unix();
                        node.send([, {
//                               <img src="data:image/jpg;base64,${pl}" width="100%">
                            payload: `
                            <html>
                            <body>
                                <img src="/choco-live.jpg?${now}" width="100%">                          
                            </body>
                            </html>
                            `
                        }]); 
                    }
                }
            })();
        });

        this.on("close",function() {
            checkLoopFlag = false;
            clearTimeout(checkLoopID);
        });
    }

    RED.nodes.registerType("choco-watcher",chocoWCtrl);

    RED.httpAdmin.get("/choco-live.jpg", RED.auth.needsPermission('chocoW.read'), function(req,res) {
        let image;
        let fname = path.join(path.resolve(), TEMPDIRNAME + "/" + TEMPIMAGEFILENAME)
        try{
            image = fs.readFileSync(fname);
          } catch(e) {
            //エラーの場合。
            image = null;
          }
        res.type("image/jpg").send(image);
    });
}
