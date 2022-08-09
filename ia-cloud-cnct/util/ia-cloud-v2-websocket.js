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
const WebSocketAsPromised = require('websocket-as-promised');
const WebSocket = require('ws');

const moment = require("moment");

class iaCloudV2websocket {

    constructor(options) {

        // instanciate websocket class
        this.wsp = new WebSocketAsPromised(options.url, {
            createWebSocket: url => new WebSocket(url, options),
            extractMessageData: event => event, // <- this is important
            packMessage: data => JSON.stringify(data),
            unpackMessage: data => JSON.parse(data),
            attachRequestId: (data, requestId) => Object.assign({id: requestId}, data), // attach requestId to message as `id` field
            extractRequestId: data => data && data.id
        });
    };

    // a innternal method for http requests
    async iaCloudRequest(body){

        try {
            if (!this.wsp.isOpened) await this.wsp.open();
            const response = await this.wsp.sendRequest(body);
            return response;

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
module.exports = iaCloudV2websocket;