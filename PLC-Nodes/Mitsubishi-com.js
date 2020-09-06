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
const path = require("path");
const fs = require("fs");
const serialp = require("serialport");

const PLCCom = require('./util/PLC-Com');
const MCProtocol = require("./util/mc-protocol/mc-protocol");

const KINDS_OF_DEV = ["error", "SM", "SD", "X", "Y", "M", "L", "F", "V", "B", "D", "W", "TN", "CN"];
const COMMUNICATION_TIMEOUT = 5000;
class MitsubishiCom extends PLCCom {
    constructor(config, MCObject){
        super(config, MCObject);
        // アクセス経路が設定されていたら
        if (config.accessRoute) 
            this.accessRoute = config.accessRoute.split("H:").join("");
        else {
            if (config.comType == "TCP") this.accessRoute = "00FF03FF00";
            if (config.comType == "Serial4") this.accessRoute = "0000FF00";
            if (config.comType == "Serial5") this.accessRoute = "0000FF03FF0000";
        }
    }
    // PLCCom のreadItemFromPLC()をMitsubishi仕様にオーバーライド
    async readItemsFromPLC(config, params) {

        let mcpObj = this.comObj;
        let values = [];
        let resp;
        let comType = config.comType;

        if (!mcpObj.isOpen) {
            if (comType == "TCP") {
                await mcpObj.connectTCP(config.IPAdd, {port: Number(config.TCPPort)});
            }
            else if (comType == "Serial4") {
                await mcpObj.connectSerialF4(config.serialPort, {baudRate: Number(config.baud), parity: config.parity});
            }
            else if (comType == "Serial5") {
                await mcpObj.connectSerialF5(config.serialPort, {baudRate: Number(config.baud), parity: config.parity}); 
            }
        }
        for (let param of params){
            resp = await mcpObj.readPLCDev(this.accessRoute, param);
            values.push({dev: param.dev, addr: param.addr, qty: param.qty, value: resp.data});
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return values;
    }

    // LinkObject形式へのデータ変換。Mitsubishi仕様にオーバーライドする。
    toLinkObjectValue(value) {
        let type = typeof value;
        if (type == "boolean")
            return (value ? "1" : "0");
        else if (type == "number")
            return '0x' + (('0000' + value.toString(16).toUpperCase()).substr(-4));
    }

    // 通信リンクオブジェクトを登録するメソッド
    // Mitsubishiの特有デバイス名でフィルタリングし、Baseクラスのメソッドコール
    addLinkData(lObj) {   
        //デバイス名が不正でないかチェック（KINDS_OF_DEVに定義したデバイスか？）
        for(let dev of Object.keys(lObj)) {
            if (!KINDS_OF_DEV.includes(dev)) delete lObj[dev];
        }
        if (Object.keys(lObj).length)  super.addLinkData(lObj);
    }
    // 通信エラーのハンドラーメソッド
    comError(err) {
        this.linkObj.error = "Mitsubishi com error!";
    }
}

module.exports = function(RED) {

    function mitsubishiCom(config) {
        RED.nodes.createNode(this, config);

        const node = this;
        const mcpObj = new MCProtocol();
        mcpObj._timeout = COMMUNICATION_TIMEOUT;
        const mccom = new MitsubishiCom(config, mcpObj);

        let cycleId;

        // 設定周期でのサイクリック通信を実施
        if (config.refreshCycle > 0) {

            (function cycle(){
                mccom.CyclicRead(RED)
                .then(() => {
                    cycleId = setTimeout(cycle, config.refreshCycle * 1000);
                });
            }());


        }
        // クローズ時にサイクリック通信を停止し、ポートをクローズ
        // このNodeがクローズされる時は、新たなDeployが行われたとき
        node.on("close",function(done) {
            clearTimeout(cycleId);
            mcpObj.close(done());
        });

        // linkObjにlinkDtataを追加するイベントリスナーを登録
        node.on("addLinkData", function(lObj) {
            if (Object.keys(lObj).length)  mccom.addLinkData(lObj);
        });
    }

    RED.nodes.registerType("Mitsubishi-com", mitsubishiCom);

    RED.httpAdmin.get("/serialports", RED.auth.needsPermission('serial.read'), function(req,res) {
        serialp.list().then(
            ports => {
                const a = ports.map(p => p.path);    // comName は path にrenameされる。要変更 
                res.json(a);
            },
            err => {
                res.json([RED._("serial.errors.list")]);
            }
        )
    });
} 
