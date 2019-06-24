module.exports = function(RED) {
    "use strict";
    var settings = RED.settings;
    var events = require("events");
    var serialp = require("serialport");
    var moment = require("moment");
    var fs = require("fs");
    
    var bufMaxSize = 32768;  // Max serial buffer size, for inputs...
    var gEnOceanData = "";

    // 温度計算をする
    function calc_temperature(data){
        var ret = [];
        if (data.length < 5*2) {
            // 5Byte以上でなければ空リスト返却
            return ret;
        }
        // javascriptでは32bit以上の数値をビットシフトできないため
        // 数値を10bit毎に分割してから計算する
        var dec = parseInt(data, 16);
        var bin = dec.toString(2);
        var dec1 = parseInt(bin.substr(0,10),2);
        var dec2 = parseInt(bin.substr(10,10),2);
        var dec3 = parseInt(bin.substr(20,10),2);
        var dec4 = parseInt(bin.substr(30,10),2);
        var decList = [];
        decList.push(dec1);
        decList.push(dec2);
        decList.push(dec3);
        decList.push(dec4);
        
        var tempList = [];
        for (var ch_val of decList) {
            var temp = 130.0 - (parseFloat(ch_val) / 1024.0 * 170.0);
            tempList.push(temp);
        }
        return tempList;
    }

    // 電流計算をする
    function calc_ac(data){
        var ret = [];
        if (data.length < 4*2) {
            // 4Byte以上でなければ空リスト返却
            return ret;
        }
        var dec = parseInt(data, 16);
        var acList = [];
        var ch_val = (dec >> 8) & 0b1111111111;
        var ad_val = parseInt(ch_val,2);
        var K = 0;
        if (ad_val < 9) {
            K = (-0.0448 * ad_val) + 1.77;
        } else if (ad_val >= 9 && ad_val < 20) {
            K = (-0.0114 * ad_val) + 1.46;
        } else if (ad_val >= 20 && ad_val < 227) {
            K = (-0.000433 * ad_val) + 1.25;
        } else if (ad_val >= 227 && ad_val < 822) {
            K = (0.0000218 * ad_val) + 1.15;
        } else {
            K = (0.000365 * ad_val) + 0.86;
        }

        var E = 1.76;
        // CT径が10mm なのでc, d は以下の数値
        var c = 56;
        var d = 3000;

        var I = (ad_val * K * E * d)/(2.8 * c);
        var ac = I / 1000;
        acList.push(ac);

        return acList;
    }

    // EnOcean-obj node function definition
    function EnOceanObjNode(config) {
        RED.nodes.createNode(this,config);
        this.object_key = config.object_key;
        this.object_desc = config.object_desc;
        this.enoceancom = config.enoceancom;
        this.enoceandataitem = config.enoceandataitem;
        
        var serialPool = config.enoceancom.serialPool;
        
        var enCom = RED.nodes.getNode(this.enoceancom);
        var node = this;
        var linkObj = [];
        var linkData = {};
        var EnObjects = [{}];
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        if (config.confsel == "fileSet"){
          // 設定ファイルの場合、ファイルを読み込んで、オブジェクトに展開
          try{
              //EnObjects = JSON.parse(fs.readFileSync(config.configfile,'utf8')).EnObjects;
              EnObjects = JSON.parse(config.configdata);
              console.log('EnObjects = ' + EnObjects);
              console.log('The number of EnObjects = ' + EnObjects.length);
          } catch(e) {
              //エラーの場合は、nodeステータスを変更。
              //node.status({fill:"red",shape:"ring",text:"runtime.badFilePath"});
              //node.error(RED._("runtime.badFilePath"), configObj);
              node.status({fill:"red",shape:"ring",text:"JSON読み込みエラー"});
              configObj = null;
          }
        } else {
            // オブジェクトがプロパティで設定されている場合、プロパティを読み込んでオブジェクトを生成
            var EnDataNode = (RED.nodes.getNode(config.enoceandataitem));
            node.log('EnDataNode = ' + JSON.stringify(EnDataNode));
            node.log('EnDataNode.dItems = ' + JSON.stringify(EnDataNode.dItems));
            
            EnObjects = [{options:{}, ObjectContent:{}}];
            EnObjects[0].options.sensor_id = EnDataNode.sensor_id;
            EnObjects[0].options.sensor_kind = EnDataNode.sensor_kind;
            EnObjects[0].objectName = "ObjectName";           // 仮設定
            EnObjects[0].objectKey = config.object_key;
            EnObjects[0].objectDescription = config.object_desc;
            EnObjects[0].ObjectContent.contentType = "iaCloudData";
            EnObjects[0].ObjectContent.contentData = EnDataNode.dItems;
        }
        if (EnObjects) {
            // 取り合えず EnObjects は要素数1としてコードを書く
            var len = EnObjects.length;
            for (var i = 0; i < len; i++) {
              linkData = {};
              linkData.sensor_id = EnObjects[i].options.sensor_id;
              linkData.nodeId = node.id;
              linkData.objectKey = EnObjects[i].objectKey;
              linkObj.push(linkData);
            }
        }
        //EnOcean-com nodeのデータ追加メソッドを呼ぶ
        enCom.addLinkData(linkObj);
        node.status({fill:"green", shape:"dot", text:"送信準備中"});
        
        //EnOceanObjNode.prototype.linkDatachangeListener = function (element) {
        this.linkDatachangeListener = function (element) {
            // 引数に [objectKey, radio_data] を受け取る
            iaCloudObjectSend(element);
        }

        var iaCloudObjectSend = function(element) {
            node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

            var msg = {request: "store", dataObject:{ObjectContent:{}}};
            var contentData = [];

            var iaObject = EnObjects.find(function(objItem, idx) {
                node.log('objItem.objectKey = ' + objItem.objectKey);
                node.log('element[0] = ' + element[0]);
                return (objItem.objectKey == element[0]);
            });
            
            if (iaObject) {
                msg.dataObject.objectKey = element[0];
                msg.dataObject.timeStamp = moment().format();
                msg.dataObject.objectType = "iaCloudObject";
                msg.dataObject.objectDescription = iaObject.objectDescription;
                msg.dataObject.ObjectContent.contentType = "iaCloudData";

                var options = iaObject.options;
                node.log('options = ' + JSON.stringify(options));
                var sensor_val = [];
                // TODO: センサー毎にコードを追加しなければならないので構成を検討する必要有り
                if (options.sensor_kind == "u-rd") {
                    sensor_val = calc_ac(element[1]);
                    node.log('calculate ac value = ' + sensor_val);
                } else {
                    sensor_val = calc_temperature(element[1]);
                    node.log('calculate temperature value = ' + sensor_val);
                }
                var contentData = iaObject.ObjectContent.contentData;
                contentData.some(function(dItem, idx) {
                    if ((idx + 1) > sensor_val.length) {
                        return true;
                    }
                    dItem.dataValue = sensor_val[idx];
                });

                msg.dataObject.ObjectContent.contentData = contentData;
                console.log(JSON.stringify(msg.dataObject));
                node.send(msg);
                /* node.status({fill:"green", shape:"dot", text:"runtime.sent"}); */
                node.status({fill:"green",shape:"dot",text:"データ送信済み"});
            } else {
                node.log('!!! 受信したobjectKeyは設定情報の中には含まれません。メッセージ送信はしません。 !!!');
            }
        }

        this.on("input", function(msg) {
            // 処理なし
        });

        this.on("close", function(done) {
            if (this.serialConfig) {
                // TODO: ここのserialPoolをSerialPortノードから取得するようにする
                serialPool.close(this.serialConfig.serialport,done);
            }
            else {
                done();
            }
        });
    }
    RED.nodes.registerType("EnOcean-obj",EnOceanObjNode);
}