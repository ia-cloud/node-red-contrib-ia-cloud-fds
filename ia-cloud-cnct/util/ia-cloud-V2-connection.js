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
const moment = require("moment");
const rest = require("./ia-cloud-v2-rest");
const wbs = require("./ia-cloud-v2-websocket");


class IaCloudAPIError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        this.message = "ia-cloud API Error";
        this.code = "IACLOUD_API_ERR";
        if (Error.captureStackTrace) Error.captureStackTrace(this, IaCloudAPIError);
    }
}
class IaCloudInvalidProtocol extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        this.message = "ia-cloud invalid protocol";
        this.code = "IACLOUD_INVALID_PROTOCOL";
        if (Error.captureStackTrace) Error.captureStackTrace(this, IaCloudInvalidProtocol);
    }
}
class IaCloudInvalidURL extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        this.message = "ia-cloud invalid URL";
        this.code = "IACLOUD_INVALID_URL";
        if (Error.captureStackTrace) Error.captureStackTrace(this, IaCloudInvalidURL);
    }
}

class iaCloudV2Connection {

    constructor( fContext, cnctInfoName,) {
        this.fContext = fContext;
        this.cnctInfoName = cnctInfoName;
        this.cnctInfo = fContext.get(cnctInfoName);
        let cnctInfo = this.cnctInfo;
        // called with a connection info.
        if (cnctInfo.hasOwnProperty("FDSKey")) {

            try {
                // regarding endpoint, use rest or websocket

                this.url = new URL(cnctInfo.url);

                if (this.url.protocol === "https:") {
                    cnctInfo.protocol = "REST";

                    // set http request options           
                    this.opts = {
                        url: cnctInfo.url,
                        method: "POST",
                        headers: {"Content-Type": "application/json", Authorization: cnctInfo.Authorization},
                        username: cnctInfo.username,
                        Authorization: cnctInfo.Authorization,
                        maxRedirects: 21,
                        proxy: cnctInfo.proxy,
                        reqTimeout: cnctInfo.reqTimeout
                    };

                    this.cnnt = new rest(this.opts);
                }
                else if (this.url.protocol === "wss:" || this.url.protocol === "ws:") {
                    cnctInfo.protocol = "webscket";

                    // set http request options           
                    this.opts = {
                        url: cnctInfo.url,
                        username: cnctInfo.username,
                        Authorization: cnctInfo.Authorization,
                        maxRedirects: 21,
                        proxy: cnctInfo.proxy,
                        reqTimeout: cnctInfo.reqTimeout
                    };

                    this.cnnt = new wbs(this.opts);
                }
                else {
                    throw new IaCloudInvalidProtocol();
                }
                //set back cnctInfo to flow context
                this.fContext.set(cnctInfoName, cnctInfo);
            }
            catch (err) {
                throw new IaCloudInvalidURL();
            }
           
        }

    };


    // a external method for a ia-cloud connect request
    async connect() {

        let info = this.cnctInfo;
        let opts = this.opts;

        // connect リクエストのリクエストボディ
        let reqbody = {
            request: "connect",
            userID: opts.username,
            Authorization: opts.Authorization,
            FDSKey: info.FDSKey,
            FDSType: "iaCloudFDS",
            timestamp: moment().format(),
            comment: info.comment
        };

        try {
            let res = await this.cnnt.iaCloudRequest(reqbody);

            if (res.userID === opts.username &&
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

    async getStatus() {

        let info = this.cnctInfo;

        // getStatus リクエストのリクエストボディ

        let reqbody = {
            request: "getStatus",
            serviceID: info.serviceID,
            timestamp: moment().format(),
            comment: info.comment
        };

        try {
            let res = await this.cnnt.iaCloudRequest(reqbody);

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

    async store(obj) {
    
        let info = this.cnctInfo;

        // リクエストのリクエストボディ
        let reqbody = {
            request: "store",
            serviceID: info.serviceID,
            dataObject: obj
        }

        try {
            let res = await this.cnnt.iaCloudRequest(reqbody);

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

    async retrieve(obj) {

        let info = this.cnctInfo;

        // node status をReqesting に
        info.status = "requesting";

        // リクエストのリクエストボディ
        let reqbody = {
            request: "retrieve",
            serviceID: info.serviceID,
            retrieveObject: obj
        }

        try {
            let res = await this.cnnt.iaCloudRequest(reqbody);

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
    
    async convey(obj) {

        let info = this.cnctInfo;

    };

    async terminate() {

        let info = this.cnctInfo;
        let opts = this.opts;

        //terminateリクエストのリクエストボディ
        let reqbody = {
            request: "terminate",
            serviceID: info.serviceID,
        }

        try {
            let res = await this.cnnt.iaCloudRequest(reqbody);

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
module.exports = iaCloudV2Connection;