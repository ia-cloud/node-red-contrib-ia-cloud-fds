
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
            plcmb.close();
        });
    };

    RED.nodes.registerType("PLC-Modbus",PLCModbus);


    RED.httpAdmin.get("/PLC.script", RED.auth.needsPermission('PLC-Modbus.read'), function(req,res) {
        let jscript;
        let fname = path.join(__dirname, 'util/PLC.script.js')
        try{
            jscript = fs.readFileSync(fname);
          } catch(e) {
            //エラーの場合。
            jscript = null;
          }
        res.type("text/javascript").send(jscript);
    });
}
