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
const TEMPDIRNAME = "temp-dir-ia-cloud/";
const fs = require("fs");

// because choco-watcher HTTP server cloud not accept lowercase headers,
// despite it is deprecated, the request module has to be used.
//const got = require('got');
const got = require("./alternative4got");

class CHOCOWAPIERROR extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        this.message = "ChocoW API Error";
        this.code = "CHOCOW_API_ERR";
        if (Error.captureStackTrace) Error.captureStackTrace(this, CHOCOWAPIERROR);
    }
}
class CHOCOWHTTPERROR extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        this.message = "ChocoW http Error";
        this.code = "CHOCOW_HTTP_ERR";
        if (Error.captureStackTrace) Error.captureStackTrace(this, CHOCOWHTTPERROR);
    }
}

class chocoWatcher {

    constructor(netAddress, flowDoneFlag, closeFlag) {
    // constructor(netAddress) {
        this.urlPref = "http://" + netAddress;
        this.flowDoneFlag = flowDoneFlag;
        this.closeFlag = closeFlag;
        let urlPref= this.urlPref;

        // prepaing http header for choco watcher API for GET method
        const getHeaders = {
            "Connection": "keep-alive",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
        }
        // prepaing http header for choco watcher API for POST method
        const postHeaders = {
            "Content-Type": "application/json",
            "Connection": "keep-alive",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
        }
        // prepaing http header for choco watcher API for GET method with parameter
        const fileHeaders = {
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Accept": "*/*",
            // the next header must be exist for the chocoW's get file API
            "If-Modified-Since": "Thu, 01 Jun 1970 00:00:00 GMT",
            "X-Requested-With": "XMLHttpRequest",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
        }
        // preparing Http request option for each API command
        this.command = {
            getHome: {url: urlPref, method: "GET", headers: getHeaders},
            getSetting: {url: urlPref + "/Setting.html", method: "GET", headers: getHeaders},
            getCamMode: {url: urlPref + "/xaccja/getCamMode", method: "GET", headers: getHeaders},
            setCamMode: {url: urlPref + "/xaccja/setCamMode", method: "POST", headers: postHeaders},
            setTimeoutExt: {url: urlPref + "/xaccja/setTimeoutExt", method: "POST", headers: postHeaders},//使ってない？
            setTrigger: {url: urlPref + "/xaccja/setTrigger", method: "POST", headers: postHeaders},
            getCamInfo: {url: urlPref + "/xaccja/getCamInfo", method: "GET", headers: getHeaders},
            setCamInfo: {url: urlPref + "/xaccja/setCamInfo", method: "POST", headers: postHeaders},
            getImageStatus: {url: urlPref + "/xaccja/getImageStatus", method: "GET", headers: getHeaders},
            getImage: {url: urlPref + "/xaccja/getImage", method: "GET", headers: fileHeaders, isStream: true},
            deletImage: {url: urlPref + "/xaccja/deletImage", method: "POST", headers: postHeaders},
            getCamImage: {url: urlPref + "/xaccja/getCamImage", method: "GET", headers: fileHeaders, isStream: true},
            getRemainingCapacity:{url: urlPref + "/xaccja/getRemainingCapacity", method: "GET", headers: getHeaders},
            getErrorLog: {url: urlPref + "/xaccja/getErrorLog", method: "GET", headers: getHeaders},//使ってない？
            getErrorCode: {url: urlPref + "/xaccja/getErrorCode", method: "GET", headers: getHeaders},
            getAlertStatus: {url: urlPref + "/xaccja/getAlertStatus", method: "GET", headers: getHeaders},
            startRecMovie: {url: urlPref + "/xaccja/startRecMovie",  method: "POST", headers: postHeaders},
            endRecMovie: {url: urlPref + "/xaccja/endRecMovie",  method: "POST", headers: postHeaders},
            deleteImage: {url: urlPref + "/xaccja/deleteImage",  method: "POST", headers: postHeaders}
        }
    }

    // async function for choco watcher API command request
    async _chocoRequest(command, param) {
        if (!param) param = {};
        try {
                // prepare http request options
                let options = Object.assign(param, this.command[command]);
                let resp;
                // if POST method, jsonize the body
                if (options.hasOwnProperty("body")) options.body = JSON.stringify(options.body);

                // http request
                resp = await got(options);
                
                if (resp.statusCode === 200){
                    if (resp.headers["content-type"] === "application/json")
                        // Convert the JSON body to the object
                        return JSON.parse(resp.body); 
                    // return body
                    else return resp.body;
                } 
                else throw new CHOCOWHTTPERROR(resp.statusCode);
        } catch(err) {
            throw new CHOCOWHTTPERROR(err);
        }
    }
    
    // async function for choco watcher file retreive API command request
    async _chocoFileRequest(file) {
        let options = {};
        let filePath;

        // temp directory for temp. files
        if (!fs.existsSync(TEMPDIRNAME)) fs.mkdirSync(TEMPDIRNAME);

        // if retreiving locked video files
        if (file && file !== "live") {
            options = Object.assign(options, this.command["getImage"]);   
            options = Object.assign(options, {searchParams: {file: file}}); 
            filePath = TEMPDIRNAME + file.split("/").slice(2,4).join("-");
        } 
        // or retreiving live image file
        else {
            options = Object.assign(options, this.command["getCamImage"]);
            filePath = TEMPDIRNAME + "choco-live.jpg";
        }

        try {
            // promisify streaming from http to file store
            await new Promise((resolve, reject) => {       
                const rs = got(options);
                const ws = fs.createWriteStream(filePath);
        
                rs.pipe(ws);
                
                let id = setInterval(() => {
                    if (this.closeFlag === true){
                        // rs.end();
                        ws.end();
                        clearInterval(id);
                    } else {
                        console.log("check End");
                    }
                }, 1000);

                // Write Stream finished ?
                // rs.on('error', (err) => {
                //     ws.end();
                //     clearInterval(id);
                // })
                ws.on('finish', () => {
                    clearInterval(id);
                    resolve();
                });
                ws.on("error", (err) => {
                    clearInterval(id);
                    reject(err);
                })
            });

            return filePath;

        } catch(err) {
            throw new CHOCOWHTTPERROR(err);
        }
    }
    // to get errorCode and alarmStatus
    async getChocoStatus() {

        let status = {};
        try{
            let body = await this._chocoRequest("getErrorCode");
            Object.assign(status,body); 
            body = await this._chocoRequest("getAlertStatus"); 
            Object.assign(status, body); 
            return status;
        }
        catch (err) {
            throw err;
        }
    };
    // geting locked video files
    async getLockedFiles() {
        try{
            // let status = await this.getChocoStatus();
            // make choco watcher rec. stop mode
            let resp = await this.endRecMovie();
            // if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            // get chocoW PLAY mode for file access          
            resp = await this.setCamMode("play");
            // if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            /*
            resp = await this.setTimeoutExt(300);
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            */
            // geting file info of locked files
            resp = await this._chocoRequest("getImageStatus");
            
            let files = resp.files;
            const fileNamePattern = /\d{3}[A-H|JKL]\d{4}/;
            // for (let i = 0; i < resp.images; i++) {
            for(let i = 0; i < files.length; i++){
                if((this.closeFlag === false) && (files[i].file.match(fileNamePattern))){
                    console.log("yomikomi Start");
                    // file retreiving API command
                    files[i].filePath = await this._chocoFileRequest(files[i].file);
                    // converting timestamp to ISO expression
                    files[i].startTime = files[i].startTime.replace(/\./g, "-").replace(" ", "T");
                    files[i].endTime = files[i].endTime.replace(/\./g, "-").replace(" ", "T");
                    console.log("yomikomi End");
                }
            }

            // await this.getSetting(); 
            // await this.getHome();
            // await this.startRecMovie();
            // await this.setCamMode("rec");
            // await this.startRecMovie();

            // this.flowDoneFlag = true;
            
            // await this.getSetting(); 
            // await this.getHome();
            // await this.startRecMovie();
            // await this.setCamMode("rec");
            // await this.startRecMovie();
            
            console.log("previous delete : " + this.closeFlag);
            if (this.closeFlag === false){
                for(let i=0; i<files.length; i++){
                    // for (let i = 0; i < resp.image; i++) {
                    console.log(files[i].file)
                    resp = await this.deleteImage(files[i].file);
                    console.log("delete Finish");
                    // if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
                }
            }
            // delete locked file that has read from choco watcher
            // for(let i=0; i<files.length; i++){
            // // for (let i = 0; i < resp.image; i++) {
            //     console.log(files[i].file)
            //     resp = await this.deleteImage(files[i].file);
            //     console.log("delete Finish");
            //     if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            // }
            // this.flowDoneFlag = true;
            // get chocoW REC mode back
            // resp = await this.setCamMode("rec");
            // if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();

            // make choco watcher rec. start mode
            await this.getSetting(); 
            await this.getHome();
            resp = await this.setCamMode("rec");
            resp = await this.startRecMovie();
            // await this.setCamMode("rec");
            // if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();

            // return with stored file infomation
            return files;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to get camera info and to write it back
    async updateChocoInfo(params) {
        try{
            let resp = await this.endRecMovie();
            let status = await this.getChocoStatus();
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            // get into Setting mode. takes 0.3 sec
            await this.getSetting(); 
            resp = await this._chocoRequest("setCamInfo", {body: params});
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            // get back to Rec mode, takes 0.8 sec
            await this.getHome(); 
            // make choco watcher rec. start mode back
            resp = await this.startRecMovie();
            status = await this.getChocoStatus();
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to get top page
    async getHome() {
        try{
            await this._chocoRequest("getHome")
            return;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to get seeting page
    async getSetting() {
        try{
            const resp = await this._chocoRequest("getSetting")
            return;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to get camera mode
    async getCamMode() {
        try{
            const mode = await this._chocoRequest("getCamMode")
            return mode;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to get camera mode
    async getCamInfo() {
        try{
            const prms = await this._chocoRequest("getCamInfo")
            return prms;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to get SD card information in choco watcher
    async getRemainingCapacity() {
        try{
            const resp = await this._chocoRequest("getRemainingCapacity")
            return resp;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to set camera mode of choco watcher
    async setCamMode(mode) {
        mode = (mode === "rec") ? "0": "1";      // mode "rec" = "0" : "play" = "1"
        try{
            const resp = await this._chocoRequest("setCamMode", {body: {camMode: mode}});
            if (!(resp.resp === "0")) throw new CHOCOWAPIERROR();
            // if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            return resp;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to set ext. timeout of choco watcher
    async setTimeoutExt(num) {
        try{
            const resp = await this._chocoRequest("setTimeoutExt", {body: {timeoutExt: num}});
            if (!(resp.resp === "0")) throw new CHOCOWAPIERROR();
            return resp;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to get camera live image of choco watcher
    async getCamImage() {
        try{
            return (await this._chocoFileRequest());
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to set trigger for rec. video of choco watcher
    async setTrigger() {
        try{
            const resp = await this._chocoRequest("setTrigger",  {body: {}});
            return resp;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to end rec. video of choco watcher
    async endRecMovie() {
        try{
            const resp = await this._chocoRequest("endRecMovie", {body: {}});
            return resp;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to start rec. video of choco watcher
    async startRecMovie() {
        try{
            const resp = await this._chocoRequest("startRecMovie", {body: {}});
            return resp;
        }
        catch (err) {
            throw err;
        }
    }
    // async function for to delete locked files of choco watcher
    async deleteImage(fileName) {
        try{
            const resp = await this._chocoRequest("deleteImage", {body: {file: fileName}});
            return resp;
        }
        catch (err) {
            throw err;
        }
    }

    async getCheckLoopStatus(checkLoopFlag){
        try{
            let checkLoopStatus =  checkLoopFlag;
            return checkLoopStatus;
        }
        catch (err) {
            throw err;
        }
    }
}
module.exports = chocoWatcher;

