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

//const got = require('got');
const moment = require('moment');
const got = require("./alternative4got");
// because choco-watcher HTTP server cloud not accept lowercase headers,
// despite it is deprecated, the request module has to be used.


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

        const getHeaders = {
            "Connection": "keep-alive",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
//                "Referer": "http://192.168.178.178/",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
        }

        const postHeaders = {
            "Content-Type": "application/json",
            "Connection": "keep-alive",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
//                "Referer": "http://192.168.178.178/",
//                "Origin": "http://192.168.178.178/",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
        }

        const fileHeaders = {
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Accept": "*/*",
            "X-Requested-With": "XMLHttpRequest",
//                "Referer": "http://192.168.178.178/",
//                "Origin": "http://192.168.178.178/",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
        }
        this.command = {
            getCamMode: {url: urlPref + "getCamMode", method: "GET", headers: getHeaders},
            setCamMode: {url: urlPref + "setCamMode", method: "POST", headers: postHeaders},
            setTimeoutExt: {url: urlPref + "setTimeoutExt", method: "POST", headers: postHeaders},
            setTrigger: {url: urlPref + "setTrigger", method: "POST", headers: postHeaders},
            getCamInfo: {url: urlPref + "getCamInfo", method: "GET", headers: getHeaders},
            setCamInfo: {url: urlPref + "setCamInfo", method: "POST", headers: postHeaders},
            getImageStatus: {url: urlPref + "getImageStatus", method: "GET", headers: getHeaders},
            getImage: {url: urlPref + "getImage", method: "GET", headers: fileHeaders},
            deletImage: {url: urlPref + "deletImage", method: "POST", headers: postHeaders},
            getCamImage: {url: urlPref + "getCamImage", method: "GET", headers: fileHeaders},
            getRemainingCapacity:{url: urlPref + "getRemainingCapacity", method: "GET", headers: getHeaders},
            getErrorLog: {url: urlPref + "getErrorLog", method: "GET", headers: getHeaders},
            getErrorCode: {url: urlPref + "getErrorCode", method: "GET", headers: getHeaders},
            getAlertStatus: {url: urlPref + "getAlertStatus", method: "GET", headers: getHeaders},
            endRecMovie: {url: urlPref + "endRecMovie",  method: "POST", headers: postHeaders}
        }

    }

    async _chocoRequest(command, param) {
        if (!param) param = {};
        try {
            let options = Object.assign(param, this.command[command]);
            if (options.hasOwnProperty("body")) 
                options.body = JSON.stringify(options.body);
            const resp = await got(options);
            if (resp.statusCode === 200){

                if (resp.headers["content-type"] === "application/json")
                    // Convert the JSON body to the object
                    return JSON.parse(resp.body); 
                // return body
                else return resp.body;
                
            } else throw "comError";
        } catch(err) {
            throw "comError";
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
            throw new CHOCOWHTTPERROR();
        }
    };

    async getLockedFiles() {
        try{
            let resp = await this.endRecMovie();
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            resp = await this.setCamMode("play");
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            resp = await this.setTimeoutExt(300);
            if (!(resp.resp === "0")) throw new CHOCOWHTTPERROR();
            resp = await this._chocoRequest("getImageStatus");
            let files = [];
            let fileData;
            for (let i = 0; i < resp.images; i++) {
                fileData= await this._chocoRequest("getImage", {searchParams: "file=" + resp.files[i].file});
                files.push(fileData);
            }
            return files;
        }
        catch (err) {
            throw new CHOCOWHTTPERROR(err);
        }
    }
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
        }
        catch (err) {
            throw new CHOCOWHTTPERROR();
        }
    }
    async getCamMode() {
        try{
            const mode = await this._chocoRequest("getCamMode")
            return mode;
        }
        catch (err) {
            throw new CHOCOWHTTPERROR();
        }
    }
    async getRemainingCapacity() {
        try{
            const resp = await this._chocoRequest("getRemainingCapacity")
            return resp;
        }
        catch (err) {
            throw new CHOCOWHTTPERROR();
        }
    }
    async setCamMode(mode) {
        mode = (mode === "rec") ? "0": "1";      // mode "rec" = "0" : "play" = "1"
        try{
            const resp = await this._chocoRequest("setCamMode", {body: {camMode: mode, json: true}});
            if (!(resp.resp === "0")) throw new CHOCOWAPIERROR();
            return resp;
        }
        catch (err) {
            throw new CHOCOWHTTPERROR();
        }
    }

    async setTimeoutExt(num) {
        try{
            const resp = await this._chocoRequest("setTimeoutExt", {body: {timeoutExt: num, json: true}});
            if (!(resp.resp === "0")) throw new CHOCOWAPIERROR();
            return resp;
        }
        catch (err) {
            throw new CHOCOWHTTPERROR();
        }
    }

    async getCamImage() {
        try{
            const image = await this._chocoRequest("getCamImage")
            return image;
        }
        catch (err) {
            throw new CHOCOWHTTPERROR();
        }
    }

    async setTrigger() {
        try{
            const resp = await this._chocoRequest("setTrigger",  {body: {}});
            return resp;
        }
        catch (err) {
            throw new CHOCOWHTTPERROR();
        }
    }
    async endRecMovie() {
        try{
            const resp = await this._chocoRequest("endRecMovie", {body: {}});
            return resp;
        }
        catch (err) {
            throw new CHOCOWHTTPERROR();
        }
    }
}
module.exports = chocoWatcher;
 