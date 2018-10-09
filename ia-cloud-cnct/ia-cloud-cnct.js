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

module.exports = function(RED) {
    "use strict";
    var request = require("request");
    var moment = require("moment");


    function iaCloudRequest(opts, callback){

        request(opts, function(err, res, body) {
            if(err){
                if(err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
                    node.error(RED._("common.notification.errors.no-response"),);
                }else{
                    node.error(err);
                }
            }else{
                // レスポンスは受けた
                if (res.statusCode != 200){
                    // レスポンスコードが 200 OK ではない
                    node.status({fill:"yellow", shape:"ring", text:"CCS Bad response"});
                    msg.payload = res.statusCode;
                    node.send(msg);
                } else {
                    // Convert the JSON body to the object
                    try { var resbody = JSON.parse(body); }
                    catch(e) { node.warn(RED._("httpin.errors.json-error")); }
                    callback(resbody);
                }
            }
        });
    }

    function iaCloudCnct(config) {

        RED.nodes.createNode(this,config);

        var node = this;
        var context = this.context();

        // 接続情報を保持するオブジェクト
        this.info = {};

        // httpリクエストのoptionを設定
        var opts = {};
        opts.url = config.url;

        opts.auth = {
            user: this.credentials.userID,
            pass: this.credentials.password
        };
        opts.method = "POST";
        opts.headers = {};
        opts.headers["Content-Type"] =  "application/json";
        opts.encoding = null;  // Force NodeJs to return a Buffer (instead of a string)
        opts.maxRedirects = 21;

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
                if (opts.url.indexOf(noprox[i]) !== -1) { noproxy=true; }
            }
        }
        if (prox && !noproxy) {
            var match = prox.match(/^(http:\/\/)?(.+)?:([0-9]+)?/i);
            if (match) {
                opts.proxy = prox;
            } else {
                node.warn("Bad proxy url: "+ prox);
                opts.proxy = null;
            }
        }

        // このタイムアウトの設定の詳細を調査する必要あり
        if (RED.settings.httpRequestTimeout) {
          opts.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 120000;
        }
        else { opts.reqTimeout = 120000; }

        // connect リクエストのタイムスタンプ
        var ts = moment().format();

        // node status をconnecting に
        node.status({fill:"blue",shape:"dot",text:"connecting to ia-cloud CCS"});

        // connect リクエストのリクエストボディ
        var reqbody = {
          request: "connect",
          userID: opts.auth.user,
          FDSKey: config.FDSKey,
          FDSType: "iaCloudFDS",
          timeStamp: ts,
          comment: config.comment
        };
        opts.body = JSON.stringify(reqbody);

        // nodeの出力メッセージ（CCS接続状態）
        var msg = {};

        iaCloudRequest(opts, function(body) {

            if (body.userID == reqbody.userID &&
              body.FDSKey == reqbody.FDSKey && body.FDSType == reqbody.FDSType ) {

              // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
              var info = reqbody;
              delete info.request;
              info.serviceID = body.serviceID;
              context.set("info", info);

              node.status({fill:"green", shape:"dot", text:"CCS connected"});
              msg.payload = body;
              node.send(msg);

            }
            else{
              node.status({fill:"yellow", shape:"ring", text:"Invalid JSON Masseage"});
              msg.payload = "Invalid JSON Message";
              node.send(msg);
            }
        });

        setInterval(function(){
            node.log("interval");

            // node status をconnecting に
            node.status({fill:"blue",shape:"dot",text:"connecting to ia-cloud CCS"});

            // getStatus リクエストのタイムスタンプ
            var ts = moment().format();

            var info = context.get("info");

            // getStatus リクエストのリクエストボディ
            var reqbody = {
              request: "getStatus",
              serviceID: info.serviceID,
              timeStamp: ts,
              comment: config.comment
            };
            opts.body = JSON.stringify(reqbody);

            // nodeの出力メッセージ（CCS接続状態）
            var msg = {};
            iaCloudRequest(opts, function(body) {

                if (body.oldServiceID == reqbody.serviceID && body.FDSKey == info.FDSKey ) {

                  // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                  info.serviceID = body.newServiceID;
                  info.timeStamp = reqbody.timeStamp;
                  context.set("info", info);
                  node.status({fill:"green", shape:"dot", text:"request done"});
                  msg.payload = body;
                  node.send(msg);
                }
                else{
                  node.status({fill:"yellow", shape:"ring", text:"Invalid JSON Masseage"});
                  msg.payload = "Invalid JSON Message";
                  node.send(msg);
                }
            });
        }, 3600000);

        this.on("input",function(msg) {

          if (msg.request == "store"
              || msg.request == "retrieve" || msg.request == "convey"){

              // node status をconnecting に
              node.status({fill:"blue", shape:"dot", text:"Requesting....."});

              // connect リクエストのタイムスタンプ
              var ts = moment().format();

              var info = context.get("info");

              // connect リクエストのリクエストボディ
              var reqbody = {
                  request: msg.request,
                  serviceID: info.serviceID,
                  dataObject: msg.dataObject
              }
              opts.body = JSON.stringify(reqbody);

              iaCloudRequest(opts, function(body) {

                  if (body.serviceID == reqbody.serviceID && body.status.toLowerCase() == "ok" ) {

                      // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                      info.serviceID = body.newServiceID;
                      context.set("info", info);
                      node.status({fill:"green", shape:"dot", text:"request done"});
                      msg.payload = body;
                      node.send(msg);
                  }
                  else{
                      node.status({fill:"yellow", shape:"ring", text:"Invalid JSON Masseage"});
                      msg.payload = "Invalid JSON Message";
                      node.send(msg);
                  }
              });

          }else{
              //requestが   "store" "retrieve" "convey" 以外
              node.status({fill:"yellow", shape:"ring", text:"Invalid ia-cloud request"});
              msg.payload = "Invalid ia-cloud request";
              node.send(msg);
          };
        });

        this.on("close",function(done) {

            var info = context.get("info");

            //terminateリクエストのリクエストボディ
            var reqbody = {
                request: "terminate",
                serviceID: info.serviceID,
            }

            opts.body = JSON.stringify(reqbody);

            iaCloudRequest(opts, function(body) {

                if (body.FDSKey == info.FDSKey && body.serviceID == reqbody.serviceID ) {
                    //node.log("ia-cloud-cnct node terminated");
                }
                else{
                    node.log("someting wrong with  terminating ia-cloud-cnct node");
                }
                done();
            });
        });
    }

    RED.nodes.registerType("ia-cloud-cnct",iaCloudCnct,{
        credentials: {
            userID: {type:"text"},
            password: {type: "password"}
        }
    });
}
