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

module.exports = function(RED) {

    class IaCloudInvalidProtocol extends Error {
        constructor(...args) {
            super(...args);
            this.name = this.constructor.name;
            this.message = "ia-cloud invalid protocol";
            this.code = "IACLOUD_INVALID_PROTOCOL";
            if (Error.captureStackTrace) Error.captureStackTrace(this, IaCloudInvalidProtocol);
        }
    }

    const {iaCloudConnection} = require("@ia-cloud/node-red-contrib-ia-cloud-common-nodes");
    const CNCT_RETRY_INIT = 1 * 60 * 1000;      //リトライ間隔の初期値1分

    function iaCloudCnct2(config) {
        RED.nodes.createNode(this,config);

        let node = this;
        let cnctRtryId;     // connect retry timer ID
        let cnctRtryFlag = true;
        let tappTimerId;    // tapping CCS (getStatus()) interval timer ID

        // ia-cloud connection config node instance
        const ccsConnectionConfigNode = RED.nodes.getNode(config.ccsConnectionConfig);

        // 接続情報を保持するオブジェクト
        let info = {
            status: "Disconnected",
            serviceID: "",
            version: ccsConnectionConfigNode.version,
            url: ccsConnectionConfigNode.url,
            protocol: "",
            userID: ccsConnectionConfigNode.credentials.userId,
            FDSKey: config.FDSKey,
            FDSType: "iaCloudFDS",
            cnctTs:"",
            lastReqTs: "",
            comment: config.comment,
            cnctRetryInterval: config.cnctRetryInterval * 60 * 1000,
            tappingInterval: config.tappingInterval * 60 * 60 * 1000,
            proxy: ccsConnectionConfigNode.proxy,
            reqTimeout: 120000
        };

        let auth = {
            username: ccsConnectionConfigNode.credentials.userId,
            password: ccsConnectionConfigNode.credentials.password,
        };

        // environmental proxy setting
        if (!info.proxy) {
            let prox;
            let noprox;
            if (process.env.http_proxy != null) { prox = process.env.http_proxy; }
            if (process.env.HTTP_PROXY != null) { prox = process.env.HTTP_PROXY; }
            if (process.env.no_proxy != null) { noprox = process.env.no_proxy.split(","); }
            if (process.env.NO_PROXY != null) { noprox = process.env.NO_PROXY.split(","); }
            info.proxy = "";
            if (noprox) {
                for (let i in noprox) {
                    if (info.url.indexOf(noprox[i]) === -1) { info.proxy = prox; }
                }
            }
        }
        // proxy server address check
        if (info.proxy) {
            let match = prox.match(/^(http:\/\/)?(.+)?:([0-9]+)?/i);
            if (!match) {
                node.warn("Bad proxy url: "+ prox);
                info.proxy = "";
            }
        }
        
        // set ia-cloud api protocol
        if (!info.version || info.version === "V1") info.protocol = "REST1";
        else if (info.version === "V2") {
            const url = new URL(info.url);
            if (url.protocol === "https:") info.protocol = "REST2";
            else if (url.protocol === "wss:" || url.protocol === "ws:") info.protocol = "websocket";
            else {throw new IaCloudInvalidProtocol();}
        }
        else {throw new IaCloudInvalidProtocol();}


        // このタイムアウトの設定の詳細を調査する必要あり
        if (RED.settings.httpRequestTimeout) {
            info.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 120000;
        }
        else { info.reqTimeout = 120000; }

        let cnctInfoName = "ia-cloud-connection-" + info.FDSKey.replace(/\s+/g, "_");
        let fContext = this.context().flow;
        fContext.set(cnctInfoName, info);

        const iaC = new iaCloudConnection(fContext, cnctInfoName, auth);

        //connect request を送出（接続状態にないときは最大cnctRetryIntervalで繰り返し）

        let rInt = CNCT_RETRY_INIT;   //リトライ間隔の初期値
        // connectリクエストのトライループ
        (async function cnctTry() {

            //非接続状態なら接続トライ
            if (info.status === "Disconnected") {
console.log("retry: " + moment().format('HH:mm:ss.SS'));
                // node status をconnecting に
                node.status({fill:"blue",shape:"dot",text:"runtime.connecting"});

                // nodeの出力メッセージ（CCS接続状態）
                let msg = {};

                // connect リクエスト
                try {
                    let res = await iaC.connect(auth);
                    node.status({fill:"green", shape:"dot", text:"runtime.connected"});
                    msg.payload = res;
                    rInt = CNCT_RETRY_INIT;   // reset retry interval
                } catch (error) {
                    node.status({fill:"yellow", shape:"ring", text:error.message});
                    msg.payload = error.message;

                    //retryの設定。倍々で間隔を伸ばし最大はcnctRetryInterval、
                    if (info.cnctRetryInterval !== 0) {
                        rInt *= 2;
                        rInt = (rInt < info.cnctRetryInterval)? rInt: info.cnctRetryInterval;
                    }  
                } finally {
                    node.send(msg);
                }

            } else {
                rInt = CNCT_RETRY_INIT;
            }
            // connect retry loop
            if (info.cnctRetryInterval !== 0 && cnctRtryFlag) 
                cnctRtryId = setTimeout(cnctTry, rInt);

        }());

        if (info.tappingInterval !== 0) {
            tappTimerId = setInterval(function(){

                //非接続状態の時は、何もしない。
                if (info.status === "Disconnected") return;

                // node status をconnecting に
                node.status({fill:"blue",shape:"dot",text:"runtime.connecting"});
                info.status = "requesting";
                let msg = {};
                (async () => {
                    // getStatus リクエスト
                    try {
                        let res = await iaC.getStatus();
                        node.status({fill:"green", shape:"dot", text:"runtime.connected"});
                        msg.payload = res;
                    } catch (error) {
                        node.status({fill:"yellow", shape:"ring", text:error.message});
                    } finally {
                        node.send(msg);
                    }
                })();
            }, info.tappingInterval) ;
        }

        this.on("input",function(msg) {

            info = fContext.get(cnctInfoName);
            //非接続状態の時は、何もしない。
            if (info.status === "Disconnected") return;
            
            if (msg.request === "store"
                || msg.request === "retrieve" || msg.request === "convey"){

                // node status をReqesting に
                node.status({fill:"blue", shape:"dot", text:"runtime.requesting"});
                info.status = "requesting";

                let dataObject = msg.dataObject;
                (async () => {
                    // リクエスト
                    try {
                        let res;
                        if (msg.request === "store") res = await iaC.store(dataObject);
                        if (msg.request === "retrieve") res = await iaC.retrieve();
                        if (msg.request === "convey") res = await iaC.convey();
                        node.status({fill:"green", shape:"dot", text:"runtime.request-done"});
                        msg.payload = res;
                    } catch (error) {
                        node.status({fill:"yellow", shape:"ring", text:error.message});
                        msg.payload = error.message;
                    } finally {
                        node.send(msg);
                    }
                })();
            }
        });

        this.on("close",function(done) {

            // stop timers for the retry and the tapping
            clearTimeout(cnctRtryId);
            clearInterval(tappTimerId);
            cnctRtryFlag = false;

            (async () => {
                //非接続状態の時は、何もせずdone()
                if (info.status !== "Disconnected") {
                    // terminate request
                    try {
                        let res = await iaC.terminate();
                        node.status({fill:"green", shape:"dot", text:"runtime.connected"});
                    } catch (error) {
                        node.status({fill:"yellow", shape:"ring", text:error.message});
                    }
                    await iaC.closeConnection();
                }
            })();
            done();
        });
    }
    
    RED.nodes.registerType("ia-cloud-cnct2",iaCloudCnct2,{
        credentials: {
            userID: {type:"text"},
            password: {type: "password"}
        }
    });
}
