
module.exports = function(RED) {
    "use strict";
    var request = require("request");
    var moment = require("moment");




    function iaCloudCnct(config) {
        // ia-cloud CCSへのhttpsリクエストの内部関数を定義
        function iaCloudRequest(opts, callback){
            request(opts, function(err, res, body) {
                var resbody = null;
                if(err){
                    if(err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
                        node.error(RED._("runtime.no-response"));
                    }else{
                        node.error(err);
                    }
                    node.status({fill:"red", shape:"ring", text:"runtime.no-response"});
                }else{
                    // レスポンスは受けた
                    if (res.statusCode != 200){
                        // レスポンスコードが 200 OK ではない
                        node.status({fill:"yellow", shape:"ring", text:"runtime.bad-response"});
                        info.serviceID = "";
                        info.status = "disconnected";
                        node.error(err);
                        node.error(res.statusCode);
                    } else {
                        // Convert the JSON body to the object
                        try { var resbody = JSON.parse(body); }
                        catch(e) { node.warn(RED._("runtime.json-error")); }
                    }
                }
                callback(resbody);
            });
        }

        RED.nodes.createNode(this,config);

        var node = this;
        const ccsConnectionConfigNode = RED.nodes.getNode(config.ccsConnectionConfig);

        // 接続情報を保持するオブジェクト
        var info = {
            status: "disconnected",
            serviceID: "",
            url: ccsConnectionConfigNode.url,
            userID: ccsConnectionConfigNode.credentials.userId,
            FDSKey: config.FDSKey,
            FDSType: "iaCloudFDS",
            cnctTs:"",
            lastReqTs: "",
            comment: config.comment,
            cnctRetryInterval: config.cnctRetryInterval * 60 * 1000,
            tappingInterval: config.tappingInterval * 60 * 60 * 1000
        };

        var gContext = this.context().global;
        gContext.set("cnctInfo", info);

        // httpリクエストのoptionを設定
        var opts = {};
        opts.url = info.url;

        opts.auth = {
            user: ccsConnectionConfigNode.credentials.userId,
            pass: ccsConnectionConfigNode.credentials.password,
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

        //connect request を送出（接続状態にないときは最大cnctRetryIntervalで繰り返し）

        var rInt = 3 * 60 * 1000;   //リトライ間隔の初期値3分
        // connectリクエストのトライループ
        (function cnctTry() {

            //非接続状態なら接続トライ
            if (info.serviceID == "") {

              // node status をconnecting に
              node.status({fill:"blue",shape:"dot",text:"runtime.connecting"});
              // connect リクエストのリクエストボディ
              var reqbody = {
                request: "connect",
                userID: info.userID,
                FDSKey: info.FDSKey,
                FDSType: "iaCloudFDS",
                timestamp: moment().format(),
                comment: info.comment
              };
              opts.body = JSON.stringify(reqbody);

              // nodeの出力メッセージ（CCS接続状態）
              var msg = {};

              iaCloudRequest(opts, function(body) {
                  // 下位層のエラー、ここでは何もしない
                  if (body == null) return;

                  if (body.userID == reqbody.userID &&
                    body.FDSKey == reqbody.FDSKey && body.FDSType == reqbody.FDSType ) {

                    // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                    info.serviceID = body.serviceID;
                    info.status = "connected";
                    info.cnctTs = moment().format();
                    node.status({fill:"green", shape:"dot", text:"runtime.connected"});
                    msg.payload = body;
                  }
                  else{
                    info.serviceID = "";
                    info.status = "disconnected";
                    node.status({fill:"yellow", shape:"ring", text:"runtime.json-error"});
                    msg.payload = "Invalid JSON Message";
                  }
                  gContext.set("cnctInfo", info);
                  node.send(msg);
              });
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

                // getStatus リクエストのリクエストボディ
                var reqbody = {
                  request: "getStatus",
                  serviceID: info.serviceID,
                  timestamp: moment().format(),
                  comment: config.comment
                };
                opts.body = JSON.stringify(reqbody);

                // nodeの出力メッセージ（CCS接続状態）
                var msg = {};
                iaCloudRequest(opts, function(body) {
                    // 下位層のエラー、ここでは何もしない
                    if (body == null){
                       info.status = "connected";
                       return;
                    }
                    if (body.oldServiceID == reqbody.serviceID && body.FDSKey == info.FDSKey ) {

                      // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                      info.serviceID = body.newServiceID;
                      info.status = "connected";
                      node.status({fill:"green", shape:"dot", text:"runtime.connected"});
                      msg.payload = body;
                    }
                    else{
                      info.serviceID = "";
                      info.status = "disconnected";
                      node.status({fill:"yellow", shape:"ring", text:"runtime.json-error"});
                      msg.payload = "Invalid JSON Message";
                    }
                      info.lastReqTs = moment().format();
                      gContext.set("cnctInfo", info);
                      node.send(msg);
                });
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

              // リクエストのリクエストボディ
              var reqbody = {
                  request: msg.request,
                  serviceID: info.serviceID,
                  dataObject: msg.dataObject
              }
              opts.body = JSON.stringify(reqbody);

              iaCloudRequest(opts, function(body) {
                  // 下位層のエラー、ここでは何もしない
                  if (body == null){
                     info.status = "connected";
                     return;
                  }
                  if (body.serviceID == reqbody.serviceID && body.status.toLowerCase() == "ok" ) {

                      // ここで、serviceIDをconfiguration nodeである自身の接続情報にセットする
                      info.serviceID = body.newServiceID;
                      info.status = "connected";
                      node.status({fill:"green", shape:"dot", text:"runtime.request-done"});
                      msg.payload = body;
                  }
                  else{
                      info.serviceID = "";
                      info.status = "disconnected";
                      node.status({fill:"yellow", shape:"ring", text:"runtime.json-error"});
                      msg.payload = "Invalid JSON Message";
                  }
                  info.lastReqTs = moment().format();
                  gContext.set("cnctInfo", info);
                  node.send(msg);
              });
          }
          else {
              //requestが   "store" "retrieve" "convey" 以外
              node.status({fill:"yellow", shape:"ring", text:"Invalid ia-cloud request"});
              msg.payload = "Invalid ia-cloud request";
              node.send(msg);
          };
        });

        this.on("close",function(done) {

            //terminateリクエストのリクエストボディ
            var reqbody = {
                request: "terminate",
                serviceID: info.serviceID,
            }
            opts.body = JSON.stringify(reqbody);

            iaCloudRequest(opts, function(body) {
                // 下位層のエラー
                if (body == null) {
                  node.status({fill:"red", shape:"ring", text:"runtime.error"});
                }
                else {
                  if (body.FDSKey == info.FDSKey && body.serviceID == reqbody.serviceID ) {
                      node.status({fill:"green", shape:"dot", text:"runtime.disconnected"});
                  }
                  else{
                      node.log("someting wrong with  terminating ia-cloud-cnct node");
                  }
                }
                info.serviceID = "";
                info.status = "disconnected";
                setTimeout(done, 3000);
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
