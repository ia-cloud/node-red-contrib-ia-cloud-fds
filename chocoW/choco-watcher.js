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

    constructor(netAddress) {
        this.urlPref = "http://" + netAddress + "/xaccja/";
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
            getCamMode: {url: urlPref + "getCamMode", method: "GET", headers: getHeaders},
            setCamMode: {url: urlPref + "setCamMode", method: "POST", headers: postHeaders},
            setTimeoutExt: {url: urlPref + "setTimeoutExt", method: "POST", headers: postHeaders},
            setTrigger: {url: urlPref + "setTrigger", method: "POST", headers: postHeaders},
            getCamInfo: {url: urlPref + "getCamInfo", method: "GET", headers: getHeaders},
            setCamInfo: {url: urlPref + "setCamInfo", method: "POST", headers: postHeaders},
            getImageStatus: {url: urlPref + "getImageStatus", method: "GET", headers: getHeaders},
            getImage: {url: urlPref + "getImage", method: "GET", headers: fileHeaders, isStream: true},
            deletImage: {url: urlPref + "deletImage", method: "POST", headers: postHeaders},
            getCamImage: {url: urlPref + "getCamImage", method: "GET", headers: fileHeaders, isStream: true},
            getRemainingCapacity:{url: urlPref + "getRemainingCapacity", method: "GET", headers: getHeaders},
            getErrorLog: {url: urlPref + "getErrorLog", method: "GET", headers: getHeaders},
            getErrorCode: {url: urlPref + "getErrorCode", method: "GET", headers: getHeaders},
            getAlertStatus: {url: urlPref + "getAlertStatus", method: "GET", headers: getHeaders},
            startRecMovie: {url: urlPref + "startRecMovie",  method: "POST", headers: postHeaders},
            endRecMovie: {url: urlPref + "endRecMovie",  method: "POST", headers: postHeaders},
            deleteImage: {url: urlPref + "deleteImage",  method: "POST", headers: postHeaders}
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
        
                // Write Stream finished ?
                ws.on('finish', async () => {
                    resolve();
                });
                ws.on("error", async (err) => {
                    reject(err);
                })
            });
            // return with stored file path
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
            // make choco watcher rec. stop mode
            let resp = await this.endRecMovie();
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            // get chocoW PLAY mode for file access          
            resp = await this.setCamMode("play");
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            /*
            resp = await this.setTimeoutExt(300);
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            */
            // geting file info of locked files
            resp = await this._chocoRequest("getImageStatus");

            let files = resp.files;
            for (let i = 0; i < resp.images; i++) {
                // file retreiving API command
                files[i].filePath = await this._chocoFileRequest(files[i].file);
                // converting timestamp to ISO expression
                files[i].startTime = files[i].startTime.replace(/\./g, "-").replace(" ", "T");
                files[i].endTime = files[i].endTime.replace(/\./g, "-").replace(" ", "T");
            }
            // delete locked file that has read from choco watcher
            for (let i = 0; i < resp.images; i++) {
                resp = await this.deleteImage(files[i].file);
                if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            }

            // get chocoW REC mode back
            resp = await this.setCamMode("rec");
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            // make choco watcher rec. start mode
            resp = await this.startRecMovie();
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();

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
            const prms = await this._chocoRequest("getCamInfo");
            // overwrite parameters to camInfo
            delete prms.firmwareVersion;

            for (let key of Object.keys(params)) {
                if(params[key]) prms[key] = params[key]
            }
            let resp = await this.endRecMovie();
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            resp = await this._chocoRequest("setCamInfo", {body: prms});
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();

            // make choco watcher rec. start mode back
            resp = await this.startRecMovie();
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
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
}
module.exports = chocoWatcher;
 