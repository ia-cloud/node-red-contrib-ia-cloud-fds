/**
 * Copyright 2019 Hiro Hashimukai on the ia-cloud project
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

// The readme of the Got package V12 says
/*
Warning: This package is native ESM and no longer provides a CommonJS export.
If your project uses CommonJS, you will have to convert to ESM. 
Please don't open issues for questions regarding CommonJS / ESM.

Got v11 is no longer maintained and we will not accept any backport requests. */

// const got = require('got');

const moment = require("moment");
const stream = require("stream");
const fs = require("fs");

class JsonParseError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        this.message = "Bad Response JSON";
        this.code = "JSON_PARSE_ERR";
        if (Error.captureStackTrace) Error.captureStackTrace(this, JsonParseError);
    }
}

class IaCloudLowerError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        this.message = "ia-cloud Lower Protcol Error";
        this.code = "IACLOUD_LOWER_ERR";
        if (Error.captureStackTrace) Error.captureStackTrace(this, IaCloudLowerError);
    }
}

class IaCloudAPIError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        this.message = "ia-cloud API Error";
        this.code = "IACLOUD_API_ERR";
        if (Error.captureStackTrace) Error.captureStackTrace(this, IaCloudAPIError);
    }
}

class iaCloudConnection {

    constructor( fContext, cnctInfoName,) {
        this.fContext = fContext;
        this.cnctInfoName = cnctInfoName;
        this.cnctInfo = fContext.get(cnctInfoName);
        let cnctInfo = this.cnctInfo;
        // called with a connection info.
        if (cnctInfo.hasOwnProperty("FDSKey")) {

            // set http request options           
            this.opts = {
                url: cnctInfo.url,
                method: "POST",
                headers: {"Content-Type": "application/json"},
                maxRedirects: 21,
//                proxy: cnctInfo.proxy,
//                reqTimeout: cnctInfo.reqTimeout
            };   
            
        }
        this.fContext.set(cnctInfoName, cnctInfo);
    };

    // a innternal method for http requests
    async _iaCloudRequest(opts, reqBodyStream){

        // The Got package became native ESM from ver.12
        const { got } = await import('got');

        // make sharrow copy of opts
        let options = {};
        Object.assign(options, opts);
        // delete url property from options
        // The `url` option is mutually exclusive with the `input` argument
        delete options["url"];
        // other options for Got package
        options.responseType = "text";

        // Got issue#1169, have to make Authorization header manually
//        options.headers["Authorization"] = "Basic " 
//            + Buffer.from(options.username + ":" + options.password).toString("base64");
//        delete options["username"];
//        delete options["password"];

        // if request body stream not exits
        if (!reqBodyStream) {
            reqBodyStream = stream.Readable.from(options.body);
        }
        // delete option.body
        delete options["body"];

        let resbody = "";

        try {
            // promisify streaming from POST request 
            await new Promise((resolve, reject) => {                

                // send POST request and create readable stream of the response
                const resBodyStream = reqBodyStream.pipe(got.stream.post(opts.url, options));
                // POST response recieved
                resBodyStream.on ("response", async response => {
                    if (response.statusCode !== 200) {
                        // response status code not 200 ok
                        reject(new IaCloudLowerError());
                    }
                });
                resBodyStream.on("data", (chunk) => {
                    resbody += chunk;
                });
                resBodyStream.on("end", () => {
                    resolve(resbody);
                });
                resBodyStream.on("error", (err) => {
                    reject(new IaCloudLowerError(err));
                });
            });
            // Convert the JSON body to the object
            try {return JSON.parse(resbody); }
            catch(e) { throw new JsonParseError(); }

        } catch(err) {
            if (err.code === 'IACLOUD_LOWER_ERR') {
                throw (err);
            }
            else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT'
                    || err.code === 'ENOTFOUND') {
                throw new IaCloudLowerError(err);
            } else {
                throw (err);
            }
        }
    };

    // a external method for a ia-cloud connect request
    async connect(auth) {

        let info = this.cnctInfo;

        // id and pass must be a string 
        if (typeof auth.user !== "string" || typeof auth.pass !== "string") {
            throw new IaCloudAPIError();
        };
        let opts = this.opts;
        opts.username = auth.user;
        opts.password = auth.pass;

        // connect リクエストのリクエストボディ
        let reqbody = {
            request: "connect",
            userID: opts.username,
            FDSKey: info.FDSKey,
            FDSType: "iaCloudFDS",
            timestamp: moment().format(),
            comment: info.comment
        };
        opts.body = JSON.stringify(reqbody);

        try {
            let res = await this._iaCloudRequest(opts);

            if (res.userID === reqbody.userID &&
                res.FDSKey === reqbody.FDSKey && 
                res.FDSType === reqbody.FDSType ) {

                // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                info.serviceID = res.serviceID;
                info.status = "Connected";
                info.cnctTs = moment().format();
                return res;
            } else {
                throw new IaCloudAPIError();
            }
        } catch(error) {
            info.serviceID = "";
            info.status = "Disconnected";
            throw error;
        } finally {
            this.fContext.set(this.cnctInfoName, info);
        }
    };

    async getStatus(auth) {

        let info = this.cnctInfo;

        // id and pass must be a string 
        if (typeof auth.user !== "string" || typeof auth.pass !== "string") {
            throw new IaCloudAPIError();
        };
        let opts = this.opts;
        opts.username = auth.user;
        opts.password = auth.pass;

        // getStatus リクエストのリクエストボディ

        let reqbody = {
            request: "getStatus",
            serviceID: info.serviceID,
            timestamp: moment().format(),
            comment: info.comment
        };
        opts.body = JSON.stringify(reqbody);

        try {
            let res = await this._iaCloudRequest(opts);

            if (res.serviceID === reqbody.serviceID 
                    && res.FDSKey === info.FDSKey ) {

                // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                info.serviceID = res.newServiceID;
                info.status = "Connected";
                info.lastReqTs = moment().format();

            } else {
                throw new IaCloudAPIError();
            }
        } catch(error) {
            info.serviceID = "";
            info.status = "Disconnected";
            throw error;
        } finally {
            this.fContext.set(this.cnctInfoName, info);
        }

    };

    async store(auth, obj) {
    
        let info = this.cnctInfo;

        // id and pass must be a string 
        if (typeof auth.user !== "string" || typeof auth.pass !== "string") {
            throw new IaCloudAPIError();
        };
        let opts = this.opts;
        opts.username = auth.user;
        opts.password = auth.pass;

        // リクエストのリクエストボディ
        let reqbody = {
            request: "store",
            serviceID: info.serviceID,
            dataObject: obj
        }
        // POST request body would be handed in the 2nd arg as stream 
        delete opts.body;
        
        let reqbodyJson, reqBodyStream;

        let fileF = false;
        if (obj.objectType === "iaCloudObject") {
            if (obj.objectContent.contentType === "Filedata") fileF = true;
        }

        // file data contentType, make requestbody stream from file
        if (fileF)  {
            let contD = obj.objectContent.contentData;
            // find file path to read
            let ind = contD.findIndex(obj => {
                return obj.commonName === "file path";
            });
            if (ind === -1) throw new Error("no file path");
            let path = contD[ind].dataValue;
            // delete file path entry from contentData 
            contD.splice(ind, 1);
            // insert encoded data entry to contentData[]
            contD.push({
                commonName: "Encoded data", 
                dataValue: "__= file content__"
            });
            // get json string of requestbody
            reqbodyJson = JSON.stringify(reqbody);
            // devide json string at encoded data position
            let objStrArray = reqbodyJson.split("__= file content__");

            await new Promise((resolve, reject) => {  
                
                try {
                    // encoded data stream from the file
                    const fileRs = fs.createReadStream(path);
                    // prepare stream for request body
                    reqBodyStream = new stream.PassThrough();
                    // write first part of request body json string
                    reqBodyStream.write(objStrArray[0]);

                    fileRs.on("data", (chunk)=> {
                        // insert encoded data from file stream
                        reqBodyStream.write(chunk);
                    });
                    fileRs.on("end", ()=> {
                        // added the last part of request body json stream
                        reqBodyStream.write(objStrArray[1]);
                        reqBodyStream.end();
                        // delete temporary base64 encoded file
                        fs.unlinkSync(path);
                        resolve();
                    });
                }
                catch (err) {
                    reject (err);
                }
            });
        }
        // other than file data contentDataType
        else {
            reqbodyJson = JSON.stringify(reqbody);
            reqBodyStream = stream.Readable.from(reqbodyJson);
        }

        try {
            let res = await this._iaCloudRequest(opts, reqBodyStream);

            if (res.serviceID === reqbody.serviceID && res.status.toLowerCase() === "ok" )  {

                // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                info.serviceID = res.newServiceID;
                info.status = "Connected";
                info.lastReqTs = moment().format();
                return res;
            } else {
                throw new IaCloudAPIError();
            }
        } catch(error) {
            info.serviceID = "";
            info.status = "Disconnected";
            throw error;
        } finally {
            this.fContext.set(this.cnctInfoName, info);
        }
    }

    async retrieve(auth, obj) {

        let info = this.cnctInfo;

        // id and pass must be a string 
        if (typeof auth.user !== "string" || typeof auth.pass !== "string") {
            throw new IaCloudAPIError();
        };
        let opts = this.opts;
        opts.username = auth.user;
        opts.password = auth.pass;

        // node status をReqesting に
        info.status = "requesting";

        // リクエストのリクエストボディ
        let reqbody = {
            request: "retrieve",
            serviceID: info.serviceID,
            retrieveObject: obj
        }
        opts.body = JSON.stringify(reqbody);

        try {
            let res = await this._iaCloudRequest(opts);

            if (res.serviceID === reqbody.serviceID && res.status.toLowerCase() === "ok" )  {

                // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                info.serviceID = res.newServiceID;
                info.status = "Connected";
                info.lastReqTs = moment().format();
                return res;
            } else {
                throw new IaCloudAPIError();
            }
        } catch(error) {
            info.serviceID = "";
            info.status = "Disconnected";
            throw error;
        } finally {
            this.fContext.set(this.cnctInfoName, info);
        }
    };
    
    async convey(auth, obj) {

        let info = this.cnctInfo;

        // id and pass must be a string 
        if (typeof auth.user !== "string" || typeof auth.pass !== "string") {
            throw new IaCloudAPIError();
        };
        let opts = this.opts;
        opts.username = auth.user;
        opts.password = auth.pass;

    };

    async terminate(auth) {

        let info = this.cnctInfo;

        // id and pass must be a string 
        if (typeof auth.user !== "string" || typeof auth.pass !== "string") {
            throw new IaCloudAPIError();
        };
        let opts = this.opts;
        opts.username = auth.user;
        opts.password = auth.pass;

        //terminateリクエストのリクエストボディ
        let reqbody = {
            request: "terminate",
            serviceID: info.serviceID,
        }
        opts.body = JSON.stringify(reqbody);

        try {
            let res = await this._iaCloudRequest(opts);

            if (res.userID === opts.username &&
                res.FDSKey === info.FDSKey && 
                res.serviceID === reqbody.serviceID ) {

                // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                info.serviceID = "";
                info.status = "Disconnected";
            } else {
                throw new IaCloudAPIError();
            }
        } catch(error) {
            throw error;
        } finally {
            this.fContext.set(this.cnctInfoName, info);
        }
    };

}
module.exports = iaCloudConnection;