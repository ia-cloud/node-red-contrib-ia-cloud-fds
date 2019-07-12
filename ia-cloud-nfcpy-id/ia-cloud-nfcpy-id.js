module.exports = function(RED) {
    'use strict';
    let nfcpyid = require('node-nfcpy-id').default;
    let moment  = require('moment');

    function nfcpyidNode(config) {
        RED.nodes.createNode(this,config);
        this.waitTime   = config.waitTime * 1000;
        this.sendTime   = config.sendTime * 1000;  // 一回の送信をまとめる時間
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
            console.error('\u001b[31m', err, '\u001b[0m');
            node.error("カードリーダーにエラーが発生しました");
        });

        node.on('close',function(){
            nfc.pause();
        });

        function timer_of_send(){   // 10秒タイマー + メッセージ送信

            let newMsg = {                  // 新規に送信するメッセージ
                "request"       : "store",
                "dataObject"    : {
                    "objectType"        : "iaCloudObjectArray",
                    "objectKey"         : "RFID",
                    "objectDescription" : "RFID",
                    "timeStamp"         : moment().format(),
                    "length"            : 0,
                    "objectArray"       : []
                }
            };
            try{
                setTimeout(() => {
                    for(let k in cardArray){
                        if(k == 0 || (k > 0 && cardArray[k].payload != cardArray[k-1].payload)){
                            // newMsg.payload.dataObject.objectArray.push({
                            newMsg.dataObject.objectArray.push({
                                "objectType"    : "iaCloudObject",
                                "objectKey"     : "cardID",
                                "instanceKey"   : "cardID" + cardArray[k].timestamp,
                                "objectContent" : cardArray[k].payload
                            //    ,"timeStamp"     : cardArray[k].timestamp
                             }); 
                        }
                    }
                    // newMsg.payload.dataObject.length = newMsg.payload.dataObject.objectArray.length;
                    newMsg.dataObject.length = newMsg.dataObject.objectArray.length;
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