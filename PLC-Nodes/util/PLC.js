
"use strict";
class PLC {
    constructor (node, RED, config){
        this.node = node;
        this.RED = RED;
        this.config = config;
        // 使用するPLC通信Node（設定Node）を取得
        this.plcCom = RED.nodes.getNode(config.comNode);
        this.linkObj = {};
        this.intervalId;
    }

    plcNode() {
        const plcnd = this;
        const node = this.node;
        const config = this.config;


        // Nodeのconfigパラメータから、dataItemオブジェクトを生成
        let dataItems = config.dataItems;

        const minCycle = 1; // 最小収集周期を10秒に設定
        // 定期収集のためのカウンターをセット
        let storeInterval = parseInt(config.storeInterval);
        let timeCount = storeInterval;

        // Nodeステータスを、preparingにする。
        node.status({fill:"blue", shape:"ring", text:"runtime.preparing"});

        // configから通信するPLCデバイス情報を取り出し、PLCCom Nodeに追加
        plcnd.makelinkObject(dataItems);

        // Nodeステータスを　Readyに
        node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        if (storeInterval !== 0) {
            this.intervalId = setInterval(function(){
                // 設定された格納周期で,PLCCom Nodeからデータを取得し、ia-cloudオブジェクトを
                // 生成しメッセージで送出
                // 複数の周期でオブジェクトの格納をするため、1秒周期でカウントし、カウントアップしたら、
                // オブジェクト生成、メッセージ出力を行う。

                // 収集周期前であれば何もせず
                timeCount = timeCount - minCycle;  
                if (timeCount > 0) return;
                
                // 収集周期がきた。収集周期を再設定。
                timeCount = storeInterval;
                plcnd.iaCloudObjectSend(config.objectKey);
                
            }, (minCycle * 1000));
        }
    }

    makelinkObject(dataItems) {

        const config = this.config;
        let linkObj = this.linkObj;
        let plcCom = this.plcCom;

        // 非同期収集ありの場合、自身のNodeIDをセット。
        let ownNodeId = this.node.id;
        // エラーリンクデータを登録
        linkObj.error = [{address: 0, value: "", preValue: "", nodeId: ownNodeId, 
                            objectKey: config.objectKey}];

        dataItems.forEach(function(dataItem) {
            let options;
            let num = 1;
            switch(dataItem.itemType) {
                case "bit":
                    options = dataItem.bit;
                    options.number = 1;
                    break;
                case "bitList":
                    options = dataItem.bitList;
                    break;
                case "number":
                    options = dataItem.number;
                    options.number = 1;
                    if (options.type == "2w-b" || options.type == "2w-l") num =  2;
                    break;
                case "string":
                    options = dataItem.string;
                    break;
                case "numList":
                    options = dataItem.numList;
                    if (options.type !== "1w") num = 2;
                    break;
                case "AnE":
                    options = dataItem.AnE;
                    options.number = 1;
                default:
            };
            num = num * options.number;

            // このデバイスタイプが初めてなら追加
            if (!linkObj[options.deviceType]) linkObj[options.deviceType] = [];
            // 各アドレスのlinkDataを登録
            for (let i = 0, l = num; i < l; i++) {
                let linkData = {value: "", preValue: ""};
                linkData.address = Number(options.address) + i;
                // すでに同じアドレスが登録されていたら中止
                let x = linkObj[options.deviceType].findIndex(
                    function(ldata) {return ldata.address === linkData.address });
                if (x >= 0) continue;   
                linkData.nodeId = ownNodeId;
                linkData.async = config.storeAsync;                
                linkData.objectKey = config.objectKey;
                linkObj[options.deviceType].push(linkData);
            }
        });

        //PLCCom nodeのデータ追加メソッドを呼ぶ
        if (plcCom) plcCom.emit("addLinkData", linkObj);
    }

    // 指定されたobjectKeyを持つia-cloudオブジェクトを出力メッセージとして送出する関数
    iaCloudObjectSend(objectKey) {
        
        const moment = require("moment");
        const iconv = require("iconv-lite");

        const config = this.config;
        const plcCom = this.plcCom;
        const node = this.node;

        // 自身のobjectKeyでなかったら何もしない。
        if(!objectKey == config.objectKey) return;

        // linkObjを取得
        let linkObj = this.linkObj;

        // 通信Nodeが存在しない場合
        if (!plcCom) {
            node.error("comNode not found");
            node.status({fill:"yellow",shape:"ring",text:"runtime.comNode"});
            return;
        }

        // PLC通信の設定Nodeでエラーが発生していれば、エラーステータスを表示し、なにもしない
        // 自身のNodeIDをセット。
        let ownNodeId = this.node.id;
        let obj = linkObj.error.find(lnkError => lnkError.nodeId === ownNodeId);
        let eMsg = obj.value;
        if (eMsg !== "ok" && eMsg !== "" ) {
            node.error(eMsg);
            node.status({fill:"red",shape:"ring",text:"runtime.comError"});
            return;
        }

        node.status({fill:"blue",shape:"ring",text:"runtime.preparing"});

        let msg = {request:"store", dataObject:{objectContent:{}}};
        let contentData = [];

        msg.dataObject.objectKey = config.objectKey;
        msg.dataObject.timestamp = moment().format();
        msg.dataObject.objectType = "iaCloudObject";
        msg.dataObject.objectDescription = config.objectDescription;
        msg.dataObject.objectContent.contentType = config.contentType;

        config.dataItems.forEach(function(dataItem) {
            // 対象のデータアイテムを作成
            let dItem;
            if (dataItem.itemType === "AnE") {
                dItem = {
                    commonName: dataItem.commonName,
                    dataValue: { AnEStatus: false,
                        AnEcode: dataItem.AnE.AnECode,
                        AnEDescription: dataItem.AnE.AnEDesc
                    }
                };           
            } else {
                dItem = {
                    dataName: dataItem.dataName,
                    dataValue: null
                };
            }
            let options;
            let value, preValue, uValue, lValue;
            let lData;

            switch(dataItem.itemType) {
                case "bit":
                    options = dataItem.bit;

                    lData = linkObj[options.deviceType].find(function(lData) {
                        return (lData.address == Number(options.address));
                    });
                    value = (Number(lData.value)) ? true: false;
                    preValue = (Number(lData.preValue)) ? true: false;
                    if (options.logic === "neg") {
                        value = !value;
                        preValue = !preValue;  
                    }
                    if (options.form === "onoff") {dItem.dataValue = (value)? "on": "off";}
                    else if (options.form === "10") {dItem.dataValue = (value)? 1: 0;}
                    else if (options.form === "opStatus") {
                        if (value) {dItem.dataValue = (preValue)? "on": "start";}
                        else {dItem.dataValue = (!preValue)? "off": "stop";}
                    }
                    else if (options.form === "AnE") {
                        if (value) {dItem.dataValue = (preValue)? "on": "set";}
                        else {dItem.dataValue = (!preValue)? "off": "reset";}
                    }
                    else dItem.dataValue = value;
                    break;
                case "bitList":
                    options = dataItem.bitList;
                    dItem.dataValue = [];
                    for (let i = 0, l = options.number; i < l; i++) {
                        value = linkObj[options.deviceType].find(function(lData){
                            return (lData.address == Number(options.address) + i);
                        }).value;
                        value = (value != "0") ? true: false;
                        if (options.logic == "neg") value = !value;
                        dItem.dataValue.push(value);
                    };
                    break;
                case "number":
                    options = dataItem.number;
                    dItem.dataValue = 0;
                    if (options.type == "1w") {
                        value = linkObj[options.deviceType]
                            .find(function(lData){
                                return (lData.address == Number(options.address));
                            }).value.slice(-4);
                    } else {
                        uValue = linkObj[options.deviceType].find(function(lData){
                            return (lData.address == Number(options.address));
                        }).value.slice(-4);
                        lValue = linkObj[options.deviceType].find(function(lData){
                            return (lData.address == Number(options.address) + 1);
                        }).value.slice(-4);
                        if (options.type == "2w-b") value = uValue + lValue;
                        if (options.type == "2w-l") value = lValue + uValue;
                    }
                    if (options.encode == "signed") dItem.dataValue = -1 - ~parseInt(value, 16);
                    if (options.encode == "unsigned") dItem.dataValue = parseInt("0" + value, 16);
                    if (options.encode == "BCD") dItem.dataValue = parseInt(value, 10);
                    dItem.dataValue = dItem.dataValue * options.gain + Number(options.offset);
                    if(options.unit) dItem.unit = options.unit;
                    break;
                case "string":                 
                    options = dataItem.string;
                    dItem.dataValue = "";
                    value = "";
                    for (let i = 0, l = options.number; i < l; i++) {
                        value = linkObj[options.deviceType].find(function(lData){
                                return (lData.address == Number(options.address) + i);
                            }).value;
                        dItem.dataValue = dItem.dataValue + value.slice(-2) + value.slice(-4, -2);
                    }
                    if (options.encode == "utf-8") {
                        dItem.dataValue = Buffer.from(dItem.dataValue, "hex").toString("utf-8");
                    }
                    else if (options.encode == "sJIS") {
                        dItem.dataValue = iconv.decode(Buffer.from(dItem.dataValue, "hex"), "shift-jis");
                    }
                    else if (options.encode == "EUC") {
                        dItem.dataValue = iconv.decode(Buffer.from(dItem.dataValue, "hex"), "EUC-JP");
                    }
                    break;
                case "numList":
                    options = dataItem.numList;
                    dItem.dataValue = [];
                    for (let i = 0, l = options.number; i < l; i++) {
                        if (options.type == "1w") {
                            value = linkObj[options.deviceType]
                            .find(function(lData){
                                return (lData.address == Number(options.address) + i);
                            }).value.slice(-4);
                        } else {
                            uValue = linkObj[options.deviceType].find(function(lData){
                                return (lData.address == Number(options.address) + 2 * i);
                            }).value.slice(-4);
                            lValue = linkObj[options.deviceType].find(function(lData){
                                return (lData.address == Number(options.address) + 2 * i + 1);
                            }).value.slice(-4);
                            if (options.type == "2w-b") value = uValue + lValue;
                            if (options.type == "2w-l") value = lValue + uValue;
                        }
                        if (options.encode == "signed") dItem.dataValue.push(-1 - ~parseInt(value, 16));
                        if (options.encode == "unsigned") dItem.dataValue.push(parseInt("0" + value, 16));
                        if (options.encode == "BCD") dItem.dataValue.push(parseInt(value, 10));
                    }
                    break;
                case "AnE":
                    options = dataItem.AnE;
                    lData = linkObj[options.deviceType].find(function(lData) {
                        return (lData.address == Number(options.address));
                    });
                    value = (Number(lData.value));
                    preValue = (Number(lData.preValue));
                    let bit = parseInt(options.bit);
                    if (!isNaN(bit)) {
                        bit = bit >= 16 ? 0: bit;
                        value = value & 1 << bit;
                        preValue = preValue & 1 << bit;
                    }
                    value = !!value;
                    preValue = !!preValue;
                    if (options.logic === "neg") {
                        value = !value;
                        preValue = !preValue;  
                    }
                    if (value) {dItem.dataValue.AnEStatus = (preValue)? "on": "set";}
                    else {dItem.dataValue.AnEStatus = (!preValue)? "off": "reset";}
                default:
            }
            contentData.push(dItem);
        });
        
        msg.dataObject.objectContent.contentData = contentData;
        // set contentData[] to msg.payload
        msg.payload = contentData;
        // Send output message to the next Nodes
        node.send(msg);
        // make Node status to "sent"
        node.status({fill:"green", shape:"dot", text:"runtime.sent"});
    }
    // 周期実行を停止する外部メソッド

    close() {
        clearInterval(this.intervalId);
    }    
}
module.exports = PLC;