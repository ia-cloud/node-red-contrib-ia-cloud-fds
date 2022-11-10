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
 const { Base64Encode } = require("base64-stream");
 const chocoWatcher = require("./choco-watcher.js");
 const path = require("path");
 
 // status read interval 10sec
 const CHECK_INTERVAL = 10 * 1000;
 // clook adjustment interval
 const CLOCK_SYNC_INTERVAL = 100;
 // delay time until temp. file deleted
 const FILEDELETDELAY = 10 * 1000;
 
 // directory name for temp files store
 const TEMPDIRNAME = "temp-dir-ia-cloud/";
 const TEMPIMAGEFILENAME = "choco-live.jpg";
 
 module.exports = function (RED) {
   function chocoWCtrl(config) {
     RED.nodes.createNode(this, config);
 
     let node = this;
     let netAddress = config.netAddress;
     let checkLoopFlag = true, checkLoopID;
 
     let errorCount = 0;
 
     // device properties of Choco Watcher
     let dateSync = config.dateSync, triggerMode = config.triggerMode;
     let eachRecTime = config.eachRecTime, periodicRecTime = config.periodicRecTime;
     let speaker = config.speaker, angle = config.angle;
 
     // functionallity properties of Choco Watcher
     let storeTiming = config.storeTiming, storePeriod = parseInt(config.storePeriod) * 60 * 60;
     let capOut = config.capOut;
     let capPeriod = config.capPeriod !== "msgOnly" ? parseInt(config.capPeriod) * 60 : config.capPeriod;
 
     // ia-cloud object properties
     let objectKey = config.objectKey, objectDescription = config.objectDescription;
     let server = config.server, serverInfo = config.serverInfo;
     let AnE = config.AnE, AnEobjectKey = config.AnEobjectKey, AnEobjectDescription = config.AnEobjectDescription;
     let status, preStatus;
 
     const watcher = new chocoWatcher(netAddress, false, false);
 
     // flag to close normally
     watcher.flowDoneFlag = false;
     watcher.closeFlag = false;
 
     // node status preparing
     node.status({ fill: "blue", shape: "ring", text: "runtime.preparing" });
 
     // preparing camera info
     let params = {
       timestamp: dateSync ? moment().format("YYYY.MM.DD HH:mm:ss") : "",
       volume: speaker !== "asis" ? speaker : "",
       recMode: triggerMode !== "asis" ? triggerMode : "",
       recDurationSD: triggerMode === "SD" && periodicRecTime !== "asis" ? periodicRecTime : "",
       recDurationDRAM: triggerMode === "DRAM" && eachRecTime !== "asis" ? eachRecTime : "",
       camAngle: angle !== "asis" ? angle : "",
     };
 
     if (fs.existsSync(TEMPDIRNAME)) fs.rmSync(TEMPDIRNAME, {foce: true, recursive: true });
 
     node.status({ fill: "green", shape: "dot", text: "runtime.ready" });
 
     (async () => {
       try {
         node.status({ fill: "blue", shape: "ring", text: "runtime.preparing" });
         await watcher.startRecMovie();
         const prms = await watcher.getCamInfo();
         // overwrite parameters to camInfo
         delete prms.firmwareVersion;
         for (let key of Object.keys(params)) {
           if (params[key]) prms[key] = params[key];
         }
         // set back camera info, takes 1.2 sec
         await watcher.updateChocoInfo(prms);
         // and get to check loop in
         await checkLoop();
       } catch (error) {
         node.status({ fill: "yellow", shape: "ring", text: "chocoWHttpError" });
         node.warn(error.toString() + " (" + RED._("runtime.settings-not-reflected") + ")" );
         watcher.flowDoneFlag = true;
       }
     })();
 
     // loop function
     async function checkLoop() {
       try {
         watcher.flowDoneFlag = false;
         watcher.closeFlag = false;
 
         let now = moment().unix();
         // node status Ready
         await watcher.setCamMode("rec");
 
         node.status({ fill: "green", shape: "dot", text: "runtime.ready" });
         // chech choco watcher status
         status = await watcher.getChocoStatus();
         // if initial error code other than E000, or error code changed
         if (AnE){
           if ((preStatus === undefined) && (status["errorStatus"].toString() !== "E000")){
             _sendAnE(status);
           } else if ((preStatus !== undefined) && (preStatus["errorStatus"].toString() !== status["errorStatus"].toString())) {
             _sendAnE(status, preStatus);
           }
         }
         preStatus = status;
 
         // check SD card
         let remainingCap = await watcher.getRemainingCapacity();
         if (remainingCap.lockFiles !== "0") {
           if (storeTiming === "each" || (storeTiming === "periodic" && now % storePeriod <= 10)) {
             node.status({fill: "green", shape: "dot", text: "runtime.getting-v-files"});
             let files = await watcher.getLockedFiles();
             if ((watcher.closeFlag === false) && (files.length > 0)) await _sendVideoFiles(files);
           }
         }
 
         // synchronize clocks
         if (dateSync && moment().unix() % CLOCK_SYNC_INTERVAL <= 10) {
           const prms = await watcher.getCamInfo();
           // overwrite parameters to camInfo
           delete prms.firmwareVersion;
           let ts = moment(prms.timestamp, "YYYY.MM.DD HH:mm:ss");
           if (Math.abs(moment(ts).unix() - moment().unix()) > 60) {
             prms.timestamp = moment().format("YYYY.MM.DD HH:mm:ss");
             await watcher.updateChocoInfo(prms);
           }
         }
 
         // sending image files
         if (capOut !== "none" && capPeriod !== "msgOnly") {
           if (now % capPeriod <= 10) {
             node.status({ fill: "green", shape: "dot", text: "runtime.getting-i-files"});
             const filePath = await watcher.getCamImage();
             if (capOut === "both" || capOut === "ia-cloud")
               await _sendImageFile(filePath);
             if (capOut === "both" || capOut === "nodeOut") {
              //which output port used for direct image output 
               let index = server ? 2 : 1;
               let msgs = [];
               msgs[index]={payload: fs.readFileSync(filePath).toString("base64")};
               node.send(msgs);
               node.status({fill: "green", shape: "dot", text: "runtime.image-out"});
             }
           }
         }
         errorCount = 0;
         // check loop
         if (checkLoopFlag) checkLoopID = setTimeout(checkLoop, CHECK_INTERVAL);
         watcher.flowDoneFlag = true;
       } catch (error) {
         watcher.flowDoneFlag = true;
         clearTimeout(checkLoopID);
         errorCount++;
         if (checkLoopFlag === true) {
           setTimeout(checkLoop, CHECK_INTERVAL);
           if(errorCount === 2){
             node.warn(RED._("runtime.device-not-connected"));
           }
         }
       }
     }
 
    // Send video files as ia-cloud objects
    async function _sendVideoFiles(files) {
      let msg1s = [], msg2s = [];
      let filePath, filePathB64;
      for (let i = 0; i < files.length; i++) {
        // if no file exist, just through to next
        if (!fs.existsSync(files[i].filePath)) continue;

        // preparing node output message of ia-cloud object
        let msg = {
          request: "store",
          dataObject: { objectType: "iaCloudObject", objectContent: {} },
        };
        msg.dataObject.objectKey = objectKey;
        msg.dataObject.objectDescription = objectDescription;
        msg.dataObject.timestamp = moment(files[i].endTime).format();

        // make unique file name for locked video file
        filePath = "ChocoW-video_" + moment(files[i].endTime).format("YYYYMMDD[T]HHmmss") + ".mov";

        // sending file data to ia-cloud CCS
        if (!server) {
          // Base64 encoded file name
          filePathB64 = filePath + ".b64";

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
            ws.on("finish", async () => {
              resolve();
            });
            ws.on("error", async (err) => {
              reject(err);
            });
          });
          // ia-cloud object to ia-cloud-cnct node(msg[0])
          msg.dataObject.objectContent.contentType = "Filedata";
          msg.dataObject.objectContent.contentData = [
            { commonName: "File Name", dataValue: filePathB64 },
            { commonName: "MIME Type", dataValue: "video/quicktime" },
            { commonName: "Encoding", dataValue: "base64" },
            { commonName: "Size", dataValue: fs.statSync(TEMPDIRNAME + filePathB64).size},
            { commonName: "file path", dataValue: TEMPDIRNAME + filePathB64 }
          ];
        }
        // sending file data to strage server
        else {
          // file name output to strage server node(msg[1])
          msg2s.push({
            payload: "",
            filename: filePath, 
            localFilename: files[i].filePath
          });
          // ia-cloud object to ia-cloud-cnct node(msg[0])
          msg.dataObject.objectContent.contentType = "Fileinfo";
          msg.dataObject.objectContent.contentData = [
            { commonName: "File Name", dataValue: filePath },
            { commonName: "MIME Type", dataValue: "video/quicktime" },
            { commonName: "Encoding", dataValue: "base64" },
            { commonName: "server Info", dataValue: serverInfo }
          ];
        }
        // remove original .mov file with time delay
        setTimeout(fs.unlinkSync, FILEDELETDELAY, files[i].filePath);

        msg1s.push(msg);
      }
      node.send([msg1s, msg2s]);
      node.status({ fill: "green", shape: "dot", text: "runtime.v-file-sent" });
      await watcher.endRecMovie();
      node.status({ fill: "blue", shape: "ring", text: "runtime.preparing" });
      await watcher.getSetting(); 
      await watcher.getHome();
      await watcher.setCamMode("rec");
      await watcher.startRecMovie();
    }

    // Send image file as ia-cloud objects
    async function _sendImageFile(imageFile) {

      // if the file not exist, just through out
      if (!fs.existsSync(imageFile)) return;
  
      let filePath, filePathB64;
    
      // preparing node output message of ia-cloud object
      let msg1 = {request: "store", dataObject: { objectType: "iaCloudObject", objectContent: {} }};
      msg1.dataObject.objectKey = objectKey;
      msg1.dataObject.objectDescription = objectDescription;
      msg1.dataObject.timestamp = moment(fs.statSync(imageFile).timestamp).format();

      let msg2;

      // make unique file name for locked video file
      filePath = "ChocoW-image_" + moment().format("YYYYMMDD[T]HHmmss") + ".jpg";

      // sending file data to ia-cloud CCS
      if (!server) {
        // Base64 encoded file name
        filePathB64 = filePath + ".b64";

        // promisify
        await new Promise((resolve, reject) => {
          const rs = fs.createReadStream(imageFile);
          const b64s = new Base64Encode();
          const ws = fs.createWriteStream(TEMPDIRNAME + filePathB64);
          // connect each stream with pipe
          rs.pipe(b64s).pipe(ws);
  
          // Write Stream finished ?
          ws.on("finish", async () => {
            resolve();
          });
          ws.on("error", async (err) => {
            reject(err);
          });
        });

        msg1.dataObject.objectContent.contentType = "Filedata";
        msg1.dataObject.objectContent.contentData = [
          { commonName: "File Name", dataValue: filePathB64 },
          { commonName: "MIME Type", dataValue: "image/jpeg" },
          { commonName: "Encoding", dataValue: "base64" },
          { commonName: "Size", dataValue: fs.statSync(TEMPDIRNAME + filePathB64).size},
          { commonName: "file path", dataValue: TEMPDIRNAME + filePathB64 }
        ];
      }
      else{
        // file name output to strage server node(msg[1] or msg[2])
        msg2 = {
          payload: "",
          filename: filePath, 
          localFilename: imageFile
        };
        // ia-cloud object to ia-cloud-cnct node(msg[0])
        msg1.dataObject.objectContent.contentType = "Fileinfo";
        msg1.dataObject.objectContent.contentData = [
          { commonName: "File Name", dataValue: filePath },
          { commonName: "MIME Type", dataValue: "image/jpeg" },
          { commonName: "Encoding", dataValue: "base64" },
          { commonName: "Server Info", dataValue: serverInfo }
        ];
      }

      node.send([msg1,msg2]);
      node.status({ fill: "green", shape: "dot", text: "runtime.i-file-sent" });
    }
 
     // Send alarm&event as ia-cloud objects
     function _sendAnE(status, preStatus={}) {
       let msg1 = {request: "store", dataObject: { objectType: "iaCloudObject", objectContent: {} }};
       msg1.dataObject.objectKey = AnEobjectKey;
       msg1.dataObject.objectDescription = AnEobjectDescription;
       msg1.dataObject.timestamp = moment().format();
       msg1.dataObject.objectContent.contentType = "Alarm&Event";
       msg1.dataObject.objectContent.contentData = [];
 
       let contentDataKey = 0;
       for (let key of Object.keys(status)) {
         if (key === "errorStatus") {
           msg1.dataObject.objectContent.contentData.push({
             commonName: key,
             dataValue: {
               AnEStatus: "on",
               AnEcode: status[key][0],
               AnEDescription: RED._("runtime.AnE." + status[key][0]),
             },
           });
         } else {
           msg1.dataObject.objectContent.contentData.push({
             commonName: key,
             dataValue: {
               AnEStatus: "on",
               AnEcode: status[key],
             },
           });
         }
         if (status[key] !== preStatus[key])
           msg1.dataObject.objectContent.contentData[contentDataKey].dataValue.AnEStatus = "set";
           contentDataKey++;
       }
       node.send([msg1]);
       node.status({ fill: "green", shape: "dot", text: "runtime.alarm-sent" });
     }
 
     // Send image from the 2nd node output
     function _outImage(imageFile) {
       node.send([, { payload: imageFile }]);
       node.status({ fill: "green", shape: "dot", text: "runtime.i-file-sent" });
     }
 
     // input mesaage event handler
     this.on("input", function (msg) {
       (async () => {
         try{
           // if trigger input to choco Watcher
           if (msg.trigger) {
             await watcher.setTrigger();
             node.status({ fill: "green", shape: "dot", text: "runtime.trigger" });
           }
           // if getting live image file
           if (msg.getImage) {
             const filePath = await watcher.getCamImage();
             if (capOut === "both" || capOut === "ia-cloud")
               _sendImageFile(filePath);
             if (capOut === "both" || capOut === "nodeOut") {

              //which output port used for direct image output 
              let index = server ? 2 : 1;
              let msgs = [];
              msgs[index]={payload: fs.readFileSync(filePath).toString("base64")};
              node.send(msgs);
              node.status({fill: "green", shape: "dot", text: "runtime.image-out"});
             }
           }
         } catch(error) {
           node.status({ fill: "yellow", shape: "ring", text: "chocoWHttpError" });
           node.warn(error.toString());
           watcher.flowDoneFlag = true;
         }
       })();
     });
 
     this.on("close", function (done) {
       watcher.closeFlag = true;
       checkLoopFlag = false;
 
       clearTimeout(checkLoopID);
       
       // flow starts when checkLoop finishes when deployed within 15 seconds
       let flowDoneCheckCount = 0;
       let closeId = setInterval(() => {
         if (watcher.flowDoneFlag === true){
           clearInterval(closeId);
           done();
         } else {
           flowDoneCheckCount++;
           if (flowDoneCheckCount === 15){
             node.warn(RED._("runtime.unexpected-close-error"));
             clearInterval(closeId);
             done();
           }
         }
       }, 1000);
     });
   }
 
   RED.nodes.registerType("choco-watcher", chocoWCtrl);
 
   RED.httpAdmin.get(
     "/choco-live.jpg",
     RED.auth.needsPermission("chocoW.read"),
     function (req, res) {
       let image;
       let fname = path.join(
         path.resolve(),
         TEMPDIRNAME + "/" + TEMPIMAGEFILENAME
       );
       try {
         image = fs.readFileSync(fname);
       } catch (e) {
         image = null;
       }
       res.type("image/jpg").send(image);
     }
   );
 };
 