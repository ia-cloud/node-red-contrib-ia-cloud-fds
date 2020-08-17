/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
"use strict";

module.exports = function(RED) {

    var connection = require("./util/ia-cloud-connection.js");

    function iaCloudCnct(config) {
        RED.nodes.createNode(this,config);

        var node = this;
        const ccsConnectionConfigNode = RED.nodes.getNode(config.ccsConnectionConfig);

        // 接続情報を保持するオブジェクト
        var info = {
            status: "disconnected",
            serviceID: "",
            url: ccsConnectionConfigNode.url,
        //    userID: ccsConnectionConfigNode.credentials.userId,
            FDSKey: config.FDSKey,
            FDSType: "iaCloudFDS",
            cnctTs:"",
            lastReqTs: "",
            comment: config.comment,
            cnctRetryInterval: config.cnctRetryInterval * 60 * 1000,
            tappingInterval: config.tappingInterval * 60 * 60 * 1000,
            proxy: null,
            reqTimeout: 12000
        };

        var gContext = this.context().global;
        gContext.set("cnctInfo", info);

        let auth = {
            user: ccsConnectionConfigNode.credentials.userId,
            pass: ccsConnectionConfigNode.credentials.password,
        };

        // proxy設定を取得
        var prox;
        var noprox;
        if (process.env.http_proxy != null) { prox = process.env.http_proxy; }
        if (process.env.HTTP_PROXY != null) { prox = process.env.HTTP_PROXY; }
        if (process.env.no_proxy != null) { noprox = process.env.no_proxy.split(","); }
        if (process.env.NO_PROXY != null) { noprox = process.env.NO_PROXY.split(","); }

        var noproxy;

        if (noprox) {
            for (var i in noprox) {
                if (info.url.indexOf(noprox[i]) !== -1) { noproxy=true; }
            }
        }
        if (prox && !noproxy) {
            var match = prox.match(/^(http:\/\/)?(.+)?:([0-9]+)?/i);
            if (match) {
                info.proxy = prox;
            } else {
                node.warn("Bad proxy url: "+ prox);
                info.proxy = null;
            }
        }

        // このタイムアウトの設定の詳細を調査する必要あり
        if (RED.settings.httpRequestTimeout) {
            info.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 120000;
        }
        else { info.reqTimeout = 120000; }


        const iaC = new iaCloudConnnection(info);

        //connect request を送出（接続状態にないときは最大cnctRetryIntervalで繰り返し）

        var rInt = 3 * 60 * 1000;   //リトライ間隔の初期値3分
        // connectリクエストのトライループ
        (function cnctTry() {

            //非接続状態なら接続トライ
            if (info.serviceID === "") {

                // node status をconnecting に
                node.status({fill:"blue",shape:"dot",text:"runtime.connecting"});

                // nodeの出力メッセージ（CCS接続状態）
                var msg = {};
                (async () => {
                    // connect リクエスト
                    try {
                        let res = await iaC.connect(auth);
                        node.status({fill:"green", shape:"dot", text:"runtime.connected"});
                        msg.payload = res;
                    } catch (error) {
                        node.status({fill:"yellow", shape:"ring", text:error.message});
                        msg.payload = error.message;
                    } finally {
                        node.send(msg);
                    }
                })();
            }
            //retryの設定。倍々で間隔を伸ばし最大はcnctRetryInterval、
            if (info.cnctRetryInterval != 0) {
                setTimeout(cnctTry, rInt);
                rInt *= 2;
                rInt = (rInt < info.cnctRetryInterval)? rInt: info.cnctRetryInterval;
            }
        }());

        if (info.tappingInterval != 0) {
            setInterval(function(){

                //非接続状態の時は、何もしない。
                if (info.serviceID == "") return;

                // node status をconnecting に
                node.status({fill:"blue",shape:"dot",text:"runtime.connecting"});
                info.status = "requesting";
                (async () => {
                    // getStatus リクエスト
                    try {
                        let res = await iaC.getStatus(auth);
                        node.status({fill:"green", shape:"dot", text:"runtime.connected"});
                        msg.payload = res;
                    } catch (error) {
                        node.status({fill:"yellow", shape:"ring", text:error.message});
                        msg.payload = error.message;
                    } finally {
                        node.send(msg);
                    }
                })();
            }, info.tappingInterval) ;
        }

        this.on("input",function(msg) {

            //非接続状態の時は、何もしない。
            if (info.serviceID == "") return;
            
            if (msg.request == "store"
                || msg.request == "retrieve" || msg.request == "convey"){

                // node status をReqesting に
                node.status({fill:"blue", shape:"dot", text:"runtime.requesting"});
                info.status = "requesting";
                (async () => {
                    // リクエスト
                    try {
                        let res;
                        if (msg.request === "store") res = await iaC.store(auth);
                        if (msg.request === "retrieve") res = await iaC.retrieve(auth);
                        if (msg.request === "convey") res = await iaC.convey(auth);
                        node.status({fill:"green", shape:"dot", text:"runtime.connected"});
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
            (async () => {
                // terminate request
                try {
                    let res = await iaC.terminate(auth);
                    node.status({fill:"green", shape:"dot", text:"runtime.connected"});

                } catch (error) {
                    node.status({fill:"yellow", shape:"ring", text:error.message});

                } finally {
                    done();
                }
            })();
        });
    }
    
    RED.nodes.registerType("ia-cloud-cnct",iaCloudCnct,{
        credentials: {
            userID: {type:"text"},
            password: {type: "password"}
        }
    });
}
