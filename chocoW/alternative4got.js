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

const request = require("request");

// alternative method for promise-ized got
function got(opt) {
    if(opt.isStream) {
        if (opt.searchParams) opt.url = opt.url + "?file=" + opt.searchParams.file;
        const respStream = request(opt);
        return respStream;
    }
    else {
        return new Promise(function(resolve, reject){
            if (opt.method === "POST") 
                opt.headers = Object.assign({"Content-Length": opt.body.length}, opt.headers);

            request(opt,function(err,res,body) {
                if (err) {
                    reject(err); 
                }
                else {
                    if (res.statusCode != 200){
                        // not 200 OK
                        reject(res);
                    }
                    else {
                        resolve(res);
                    }
                }
            })
        })
    }
}

module.exports = got;
 