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
    const moment = require("moment");

    const setConfig2node = (configObjects, config) => {

        let linkObj = {links:[]};
        linkObj.nodeID = config.id

        /* ikano Link objectを利用して、MurataCom node とデータを共有
        linObj = {
            nodeID: node.id,
            links: [{
                objectKey: "",
                sensorId: "",
                inteval: "1h",
                enableFFT: true,
                rms: value,
                sharpness: value,
                bttry: value,
                temp: value,
                rssi: "value",
                freq1: "value",
                acce1: "value",
                freq2: "value",
                acce2: "value",
                freq3: "value",
                acce3: "value",
                freq4: "value",
                acce4: "value",
                freq5: "value",
                acce5: "value"
            },  ....  ]
        }
        */

        // 複数のia-cloud objectの設定を一つづつ取出して処理。
        configObjects.forEach(function(objItem, idx) {
            let linkData = {};
            linkData.objectKey = objItem.objectKey;
            linkData.sensorId = objItem.sensorId;
            linkData.interval = objItem.interval;
            linkData.enableFFT = objItem.enableFFT;

            // 必要なデータ項目のキーを設定
            // FFT disable でも、全部あっても良いかも・・・
            
            linkObj.links.push(linkData);
        });
        //modbusCom nodeのデータ追加メソッドを呼ぶ
        mbCom.emit("addLinkData", linkObj);

    }

    function mrataSensor(config) {

        RED.nodes.createNode(this,config);

        let node = this;
        let configObjects = [{}];

        // Murata Gateway UDP com configration node
        let murataCom = RED.nodes.getNode(config.murataCom);

        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});
        
        // 設定ファイルの場合、ファイルを読み込んで、オブジェクトに展開
        if (config.confsel == "file"){
            try{
                configObjects = JSON.parse(config.configObjects)
            } catch(e) {
                //エラーの場合は、nodeステータスを変更。
                node.status({fill:"red", shape:"ring", text:"runtime.badConfig"});
                node.error(RED._("runtime.badConfig"));
                configObjects = null;
            }
        // オブジェクトがプロパティで設定されている場合、プロパティを読み込んでオブジェクトを生成
        } else if(config.confsel == "UI") {
            configObjects[0].objectName = config.objectName;
            configObjects[0].objectKey = config.objectKey;
            configObjects[0].objectDescription = config.objectDescription;
            configObjects[0].sensorId = config.sensorId;
            configObjects[0].storeInterval = config.storeInterval;
            configObjects[0].enableFFT = config.enableFFT;
            configObjects[0].contentType = config.contentType;
            configObjects[0].itemList = config.itemList;
            configObjects[0].autoConf = config.autoConf;
        }

        // config object が空でなかったら
        // configObjから通信で取得する情報を取り出し、MurataCom Nodeに追加
        if (configObjects) {

            // config object に沿ってlonkObjを作成し、通信設定Nodeに登録 
            setConfig2node(configObjects, config);

            // Nodeステータスを　Readyに
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        }

        this.on("changeListener",function(objectKeys) {
            //登録したlinkObに変化があったら呼ばれる。
            //そのlinkObjを参照するia-cloudオブエクトをstoreする。
            objectKeys.forEach(function(key, idx) {
                iaCloudObjectSend(key);
            });
        });

        // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして早出する関数
        // 実装未完・確認未完
        var iaCloudObjectSend = function(objectKey) {
            // nodeステータスをセット
            node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

            var msg = {request:"store", dataObject:{ObjectContent:{}}};
            var contentData = [];

            var confObj = configObjects.find(function(objItem, idx) {
              return (objItem.objectKey == objectKey);
            });

            // linkObjには、新しく取得しパースされたdataValueが格納されているので、これを読み出し、
            // contentDataに格納する。

            //  ここにコードを追加

            // 対応するobjectKey の設定情報を取出し、ia-cloudオブジェクトを生成して、メッセージ出力する。
            msg.dataObject.objectKey = objectKey;
            msg.dataObject.timestamp = moment().format();
            msg.dataObject.objectType = "iaCloudObject";
            msg.dataObject.objectDescription = confObj.objectDescription;
            msg.dataObject.ObjectContent.contentType = confObj.contentType;

            msg.dataObject.ObjectContent.contentData = contentData;
            msg.payload = contentData;
            node.send(msg);
            node.status({fill:"green", shape:"dot", text:"runtime.sent"});
        }
        this.on("input",function(msg) {

            // 実装未完・未確認
            // MurataComに登録してあるLinjObjを削除
            // キーは、登録時に使った自身のNodeId
            mbCom.emit("removeLinkData", node.id);

            // 入力メッセージのmsg.configObjectsを取出し、自身のnode.config.configObjectsを書換え、
            // setConfig2Node()をコール
            setConfig2node(configObjects, config);
        });
        this.on("close",function(done) {
            //何もしない
        });
    }

    RED.nodes.registerType("murata-sensor",mrataSensor);

}
