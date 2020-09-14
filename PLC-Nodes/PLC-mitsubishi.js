
"use strict";

const path = require("path");
const fs = require("fs");
const PLC = require('./util/PLC');

module.exports = function(RED) {

    function PLCMitsubishi(config) {

        RED.nodes.createNode(this, config);
        
        const plcmc = new PLC(this, RED, config);
        plcmc.plcNode();

        //登録したlinkObに変化があったら呼ばれる。
        // 通信エラーがあっても呼ばれる
        this.on("changeListener",function(objectKeys) {

            //そのlinkObjを参照するia-cloudオブエクトをstoreする。
            objectKeys.forEach(function(key, idx) {
                plcmc.iaCloudObjectSend(key);
            });
        });

        this.on("input",function(msg) {
            if (msg.payload) iaCloudObjectSend(config.objectKey);
        });
        this.on("close",function() {
            plcmc.close();
        });
    };

    RED.nodes.registerType("PLC-Mitsubishi",PLCMitsubishi);


    RED.httpAdmin.get("/PLC.script", RED.auth.needsPermission('PLC-Mitsubishi.read'), function(req,res) {
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
