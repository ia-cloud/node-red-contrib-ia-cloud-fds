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

class iaCloudV2Rest {

    constructor(opts) {
       this.opts = opts;
    };

    // a innternal method for http requests
    async iaCloudRequest(body){

        // The Got package became native ESM from ver.12
        const { got } = await import('got');

        // make sharrow copy of opts
        let options = {};
        Object.assign(options, this.opts);
        // delete url property from options
        // The `url` option is mutually exclusive with the `input` argument
        delete options["url"];

        // other options for Got package
        options.responseType = "text";

        //JSON stringify options.body
        options.body = JSON.stringify(body);

        try {
            const response = await got(this.opts.url, options);
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

}
module.exports = iaCloudV2Rest;