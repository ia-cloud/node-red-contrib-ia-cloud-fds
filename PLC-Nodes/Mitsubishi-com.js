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
const MCProtocol = require("./util/MCProtocol/MCProtocol");

// const MitsubishiSLMP = require('./util/mitsubishi-SLMP');
const PLCCom = require('./util/PLC-Com');

class MitsubishiCom extends PLCCom {
    constructor(config, MCObject){
        super(config, MCObject);
    }
    // PLCCom のreadItemFromPLC()をMitsubishi仕様にオーバーライド
    async readItemsFromPLC(config, params) {

        let mcpObj = this.comObj;
        let values = [];
        let resp;

        let TCPOptions = {port: Number(config.port)};
        let serialOptions = {baudRate: config.baud, parity: config.parity};
        let accessRoute = [];
        if (config.accessRout) {
            accessRoute = config.accessRoute.split(":");
        }
        else{
            accessRout = ["00","FF","3FFF","00"];
        }

        if (config.comType == "TCP") {
            await mcpObj.connectTCP(config.IPAdd, TCPOptions)
        }
        else if (config.comType == "Serial4") {
            await mcpObj.SerialF4(config.serialPort, serialOptions);
        }
        else if (config.comType == "Serial5") {
            await mcpObj.SerialF5(config.serialPort, serialOptions);
        }

        for (let param of params){

            resp = await mcpObj.readPLCDev(accesssRoute, param.addr, param.qty);

            values.push({dev: param.dev, addr: param.addr, qty: param.qty, value: resp.data});
        }
        await mcpObj.close();
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
        //デバイス名が不正でないかチェック（error,Coil,IS,HR,IR）
        for(let dev of Object.keys(lObj)) {
            if (!(dev == "error") && !(dev == "Coil") && !(dev == "IS") && !(dev == "HR") && !(dev == "IR"))
                delete lObj[dev];
        }
        if (Object.keys(lObj).length)  super.addLinkData(lObj);
    }
    // 通信エラーのハンドラーメソッド
    comError(err) {
        this.linkObj.error = "Mitsubishi com error!";
    }
}

module.exports = function(RED) {

    function modbusCom(config) {
        RED.nodes.createNode(this, config);

        const node = this;
        const mcpObj = require("./util/MCProtocol/MCProtocol");

        const mccom = new MitsubishiCom(config, mcpObj);

        let cycleId;

        // 設定周期でのサイクリック通信を実施
        if (config.refreshCycle > 0) {
//            cycleId = setInterval(mccom.CyclicRead, config.refreshCycle * 1000, RED);

            (function cycle(){
                mccom.CyclicRead(RED)
                .then(() => {
                    setTimeout(cycle, config.refreshCycle * 1000)
                });
            }());


        }
        // クローズ時にサイクリック通信を停止
        // このNodeがクローズされる時っていつ？　誰からも呼ばれなくなったら停止する機能はない？
        // linkObjが空だったら止めるはあり？
        node.on("close",function(done) {
            clearInterval(cycleId);
            mcpObj.close().then(done());
        });

        // linkObjにlinkDtataを追加するイベントリスナーを登録
        node.on("addLinkData", function(lObj) {
            if (Object.keys(lObj).length)  mccom.addLinkData(lObj);
        });
    }

    RED.nodes.registerType("Mitsubishi-com",modbusCom);

    RED.httpAdmin.get("/serialports", RED.auth.needsPermission('serial.read'), function(req,res) {
        serialp.list().then(
            ports => {
                const a = ports.map(p => p.comName);
                res.json(a);
            },
            err => {
                res.json([RED._("serial.errors.list")]);
            }
        )
    });

    RED.httpAdmin.get("/PLC-Com.script", RED.auth.needsPermission('Mitsubishi-com.read'), function(req,res) {
        let jscript;
        let fname = path.join(__dirname, 'util/PLC-Com.script.js')
        try{
            jscript = fs.readFileSync(fname);
          } catch(e) {
            //エラーの場合。
            jscript = null;
          }
        res.type("text/javascript").send(jscript);
    });
} 
