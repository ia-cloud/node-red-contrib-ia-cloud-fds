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

module.exports = function(RED) {
    'use strict';
    let nfcpyid = require('node-nfcpy-id').default;
    let moment  = require('moment');

    function nfcpyidNode(config) {
        RED.nodes.createNode(this,config);
        this.waitTime   = config.waitTime * 1000;
        this.sendTime   = config.sendTime * 1000; // 一回の送信をまとめる時間
        this.objectKey  = config.objectKey;       // 送信するJSONのobjectKey
        this.dataName   = config.dataName;        // 送信するJSONのdataName
        let node        = this;
        let nfc         = new nfcpyid({mode:'non-touchend'}).start();
        let startTime   = false;              // 10秒ポーリング開始時間
        let cardArray   = [];                 // メッセージを貯める配列,カードID,タイプ、受信時刻

        this.status({fill:"green",shape:"ring",text:"ia-cloud-nfcpy.runtime.waiting"});
        nfc.on('touchstart', (card) => {
            try{
                this.status({fill:"green",shape:"dot",text:"ia-cloud-nfcpy.runtime.touched"});
                if(startTime == false && cardArray.length == 0){
                    startTime = moment().unix();
                    timer_of_send(node);
                }
                setTimeout(() =>{
                    nfc.start();
                    this.status({fill:"green",shape:"ring",text:"ia-cloud-nfcpy.runtime.waiting"});
                },node.waitTime);
                let msg = {
                    "payload"   : card.id,
                    "type"      : card.type,
                    "timestamp" : moment().format()
                };
                cardArray.push(msg);
            }catch(err){
                node.error("touchstartイベントでエラーが発生しました");
                restart_nfc(nfc);
            }
        });

        nfc.on('error', (err) => {
            // standard error output (color is red)
            node.error('\u001b[31m', err, '\u001b[0m');
            node.error("カードリーダーにエラーが発生しました");
        });

        node.on('close',function(){
            nfc.pause();
        });

        function timer_of_send(){   // 10秒タイマー + メッセージ送信

            let newMsg = {          // 新規に送信するメッセージ
              "request"       : "store",
              "dataObject"    : {
                  "objectType"        : "iaCloudObjectArray",
                  "objectKey"         : node.objectKey,
                  "objectDescription" : "RFID_cardID",
                  "timestamp"         : moment().format(),
                  "length"            : 0,
                  "ObjectArray"       : []
              }
            };
            try{
                setTimeout(() => {
                    for(let k in cardArray){
                        if(k == 0 || (k > 0 && cardArray[k].payload != cardArray[k-1].payload)){
                            newMsg.dataObject.ObjectArray.push({
                                "objectType"    : "iaCloudObject",
                                "objectKey"     : node.objectKey,
                                "instanceKey"   : "cardID" + cardArray[k].timestamp,
                                "objectContent" : {
                                  "contentType"   : "iaCloudData",
                                  "contentData"   : [
                                    {
                                      "dataName"    : node.dataName,
                                      "dataValue"   : cardArray[k].payload,
                                      "unit": null
                                    }
                                  ]
                                }
                            });
                        }
                    }
                    newMsg.dataObject.length = newMsg.dataObject.ObjectArray.length;
                    startTime   = false;
                    cardArray   = [];
                    node.send(newMsg);
                }, node.sendTime);
            }catch(err){
                node.error("タイマーでエラーが発生しました");
                restart_nfc();
            }
        }
        function restart_nfc(nfc){
            try{
                nfc.pause();
                nfc.start();
            }catch(err){
            }
        }
    }
    RED.nodes.registerType("RFID",nfcpyidNode);
}