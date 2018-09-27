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

  function iaCloudCnct(config) {
    RED.nodes.createNode(this,config);

this.log("start");
this.log(config.name);
this.log(config.FDSKey);
this.log(config.url);

    var node = this;
    // node status をconnecting に
    node.status({fill:"blue",shape:"dot",text:"connecting to ia-cloud CCS"});

    // 接続情報を保持するオブジェクト
    this.info = {};

    // httpリクエストのoptionを設定
    var opts = {};
    opts.url = config.url;
    opts.method = "POST";
    opts.headers = {contentType : "application/json"};
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
    if (RED.settings.httpRequestTimeout) { opts.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 120000; }
    else { opts.reqTimeout = 120000; }

    // CCS のIDパスワードを設定
    if (this.credentials && this.credentials.user) {
        opts.auth = {
            user: this.credentials.user,
            pass: this.credentials.password||""
        };
    }
    // connect リクエストのタイムスタンプ
    var ts = moment().format();

    // connect リクエストのリクエストボディ
    var reqbody = {
      request: "connect",
      userID: config.iaCloudID,
      FDSKey: config.FDSKey,
      FDSType: "iaCloudFDS",
      timestamp: ts,
      comment: config.comment
    }
    opts.body = reqbody;

    // nodeの出力メッセージ（CCS接続状態）
    var msg = {};
console.dir(opts.body.request);
console.dir(opts.body.userID);
console.dir(opts.body.FDSKey);
console.dir(opts.body.timestamp);
console.dir(opts.body.comment);

    request(opts, function(err, res, body) {

      if(err){
        //http(s)レベルのエラー
this.log(errが起きた);

        msg.payload = err.toString() + " : " + opts.url;
        msg.statusCode = err.code;
        if(err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
            node.error(RED._("common.notification.errors.no-response"), msg);
            node.status({fill:"red", shape:"ring", text:"common.notification.errors.no-response"});
        }else{
            node.error(err,msg);
            node.status({fill:"red", shape:"ring", text:err.code});
        }
        node.send(msg);

      }else{
        // レスポンスは受けた
        msg.statusCode = res.statusCode;
        msg.payload = body;

        if (msg.statusCode != 200){
          // レスポンスコードが 200 OK ではない
          msg.payload = "Bad response";
          node.status({fill:"yellow", shape:"ring", text:"CCS Bad response"});
          node.send(msg);

        } else {
          // Convert the JSON body to the object
          try { msg.payload = JSON.parse(msg.payload); }
          catch(e) { node.warn(RED._("httpin.errors.json-error")); }

          if (msg.statusCode == 200 && msg.payload.userID == opts.body.userID
              && msg.payload.FDSKey == opts.body.FDSKey
              && msg.payload.FDSType == opts.body.FDSType ) {

            // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
            info = rbody;
            delete info.request;
            info.serviceID = body.serviceID;

            node.status({fill:"green", shape:"dot", text:"CCS connected"});
            node.send(msg);

          }
          else{
            node.status({fill:"yellow", shape:"ring", text:"Invalid JSON Masseage"});
            msg.payload = "Invalid JSON Message";
            node.send(msg);
          }
        }
      }
    });

    this.on("input",function(msg) {

      if (msg.request == "store" || msg.request == "retrieve" || msg.request == "convey"){

        node.status({fill:"blue", shape:"dot", text:"Requesting....."});
        // connect リクエストのタイムスタンプ
        var ts = moment().format();

        // connect リクエストのリクエストボディ
        var reqbody = {
          request: msg.request,
          serviceID: info.serviceID,
          dataObject: msg.dataObject
        }
        opts.body = reqbody;

        request(opts, function(err, res, body) {

          if(err){
            msg.payload = err.toString() + " : " + opts.url;
            msg.statusCode = err.code;
            if(err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
                node.error(RED._("common.notification.errors.no-response"), msg);
                node.status({fill:"red", shape:"ring", text:"common.notification.errors.no-response"});
            }else{
                node.error(err,msg);
                node.status({fill:"red", shape:"ring", text:err.code});
            }
            node.send(msg);

          }else{

            msg.statusCode = res.statusCode;
            msg.payload = body;

            if (msg.statusCode != 200){

              msg.payload = "Bad response";
              node.status({fill:"yellow", shape:"ring", text:"CCS Bad response"});
              node.send(msg);

            } else {

              // Convert the JSON body to the object
              try { msg.payload = JSON.parse(msg.payload); }
              catch(e) { node.warn(RED._("httpin.errors.json-error")); }

              if (msg.payload.serviceID == info.serviceID ) {
                // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                info.serviceID = msg.payload.newServiceID;

                node.status({fill:"green", shape:"dot", text:"request done"});
                node.send(msg);
              }
              else{
                node.status({fill:"yellow", shape:"ring", text:"Invalid JSON Masseage"});
                msg.payload = "Invalid JSON Message";
                node.send(msg);
              }
            }
          }
        });
      }
    });

    this.on("close",function() {

      //terminateリクエストのリクエストボディ
      var rbody = {
        request: "terminate",
        serviceID: info.serviceID,
      }
      opts.body = reqbody;

      request(opts, function(err, res, body) {
        if(err){
          if(err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
              node.error(RED._("common.notification.errors.no-response"),);
          }else{
            node.error(err);
          }
        }else{
          // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
          if (body.userID != opts.body.userID || body.FDSKey != opts.body.FDSKey
              || body.serviceID != opts.body.serviceID ) {

            node.error("Could not terminate CCS connection");
          }
        }
      });
    });
  }

  RED.nodes.registerType("ia-cloud-cnct",iaCloudCnct,{
    credentials: {
      user: {type:"text"},
      password: {type: "password"}
    }
  });
}
