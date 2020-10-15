
"use strict";
const got = require('got');
const moment = require("moment");

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
                proxy: cnctInfo.proxy,
                reqTimeout: cnctInfo.reqTimeout
            };   
            
        }
        this.fContext.set(cnctInfoName, cnctInfo);
    };

    // a innternal method for http requests
    async _iaCloudRequest(opts){
        // make sharrow copy of opts
        let options = {};
        Object.assign(options, opts);
        // delete url property from options
        // The `url` option is mutually exclusive with the `input` argument
        delete options["url"];
        // other options for Got package
        options.responseType = "text";

        try {
            const response = await got(opts.url, options);
            if (response.statusCode === 200){
                let resbody;
                // Convert the JSON body to the object
                try {resbody = JSON.parse(response.body); }
                catch(e) { throw new JsonParseError(); }
                return resbody;
            } else {
                // レスポンスコードが 200 OK ではない
                throw new IaCloudLowerError();
            }
        } catch (err) {
            if(err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT'
                                        || err.code === 'ENOTFOUND') {
                throw new IaCloudLowerError();
            }else{
                throw err;
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