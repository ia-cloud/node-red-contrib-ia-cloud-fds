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
const PLC = require('./util/PLC');

module.exports = function(RED) {

    function PLCModbus(config) {

        RED.nodes.createNode(this, config);
        
        const plcmb = new PLC(this, RED, config);
        plcmb.plcNode();

        //登録したlinkObに変化があったら呼ばれる。
        // 通信エラーがあっても呼ばれる
        this.on("changeListener",function(objectKeys) {

            //そのlinkObjを参照するia-cloudオブエクトをstoreする。
            objectKeys.forEach(function(key, idx) {
                plcmb.iaCloudObjectSend(key);
            });
        });

        this.on("input",function(msg) {
            if (msg.payload) iaCloudObjectSend(config.objectKey);
        });
        this.on("close",function() {
            clearInterval(intervalId);
        });
    };

    RED.nodes.registerType("PLC-Modbus",PLCModbus);


    RED.httpAdmin.get("/PLCscript", RED.auth.needsPermission('PLC-Modbus.read'), function(req,res) {
        let jscript;
        let fname = path.join(__dirname, 'util/PLC.script.js')
        try{
            jscript = fs.readFileSync(fname);
          } catch(e) {
            //エラーの場合。
            jscript = null;
          }
        res.send(jscript);
    });
}
