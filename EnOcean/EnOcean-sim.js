/**
 * Copyright 2023 Hiro Hashimukai on the ia-cloud project
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

"use strict";

const iconv = require("iconv-lite");
const fs = require("fs");
const path = require("path");

const MAX_COUNT = 24 * 60 * 60;
const W_START = 100;
const DW_START = 200;
const B_START = 100;
const A_START = 200;
const SJIS_START = 300;
const EUC_START = 400;
const UTF_START = 500;

let TEST_STRING = "テスト文字列"

module.exports = function(RED) {

    function EnOceanSim(config) {
        RED.nodes.createNode(this, config);

        const node = this;
        const minCycle = 1; // 最小収集周期を1秒に設定
        // 定期更新のためのカウンターをセット
        let interval = parseInt(config.interval);
        let timeCount = interval;
        let EnOceanSim = {};
        try {
            let EnOceanJson = fs.readFileSync(path.resolve(__dirname, "../EnOcean-Nodes/EnOcean-sim.json"), "utf-8");
            EnOceanSim = JSON.parse(EnOceanJson);
        }
        catch (err) {
            //エラーの場合は、nodeステータスを変更。
            node.status({fill:"red", shape:"ring", text:"runtime.badPLData"});
            node.error(RED._("runtime.badEnOceanData"));
        }

        let count = 0;
        let gContext = this.context().global;
        gContext.set("EnOceanSimulator", EnOceanSim);
        
        if (interval !== 0 && Object.keys(EnOceanSim.lenth !== 0)) {

            // Nodeステータスを　Readyに
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});
            this.intervalId = setInterval(function(){

                // 収集周期前であれば何もせず
                timeCount = timeCount - minCycle;  
                if (timeCount > 0) return;
                
                // 周期がきた。周期を再設定。
                timeCount = interval;

                if (++count > MAX_COUNT) count = 0;
                cyclic(gContext, count);
                
            }, (minCycle * 1000));
        }

        this.on("input",function(msg) {
            if (msg.payload) {



            }

        });
        
        this.on("close",function(done) {
            clearInterval(this.intervalId);
            done();
        });

        function cyclic (gContext, count){
            let EnOceanSim = gContext.get ("EnOceanSimulator");
            // if not EnOcean-simulator context data exist
            if(!EnOceanSim) return;
            let mb = EnOceanSim.modbus;
            let mitsu = EnOceanSim.mitsubishi;

            // creating count data 
            let count60 = (count % 60);
            let count600= (count % (10 * 60));
            let count3600 = (count % (60 * 60));
            // word count data
            let v = [];
            v =  [count60, count600, count3600, count];
            mitsu.D.countupW.value = v.concat();
            mb.HR.countupW.value = v.concat();
            // Double word count data
            v = [
                count60 & 0xffff, count60 >>> 16, count600 & 0xffff, count600 >>> 16,
                count3600 & 0xffff, count3600 >>> 16, count & 0xffff, count >>> 16
            ];
            mitsu.D.countupDW.value = v.concat();
            mb.HR.countupDW.value =v.concat();
            // 16bit Data
            v = [];
            for (let i = 0 ; i < 16 ; i++) {
                v[i] = !!((count >>> i) & 1);
            } 
            mitsu.M.countupBits16.value = v.concat();
            mb.IS.countupBits16.value = v.concat();
            // Alarm & event data
            v = [(count60 > 5 && count60 < 15), 
                (count600 > 30 && count600 < 60),
                (count3600 > 500 && count3600 < 800),
                (count > 8000 && count < 12000)]
            mitsu.M.alarmEvent.value = v.concat();
            mb.IS.alarmEvent.value = v.concat();
            // shift-JIS string
            mitsu.D.shiftJIS.value = string2wordArray(mitsu.D.shiftJIS.string, "shift-jis");
            mb.HR.shiftJIS.value = string2wordArray(mb.HR.shiftJIS.string, "shift-jis");
            // EUC-jp string
            mitsu.D.EUCjp.value = string2wordArray(mitsu.D.EUCjp.string, "EUC-JP");
            mb.HR.EUCjp.value = string2wordArray(mb.HR.EUCjp.string, "EUC-JP");
            // utf-8 string
            mitsu.D.utf8.value = string2wordArray(mitsu.D.utf8.string, "utf-8");
            mb.HR.utf8.value = string2wordArray(mb.HR.utf8.string, "utf-8");
            //　Omron temp. controller PV
            mb.HR.omronCtrlPVetc.value[0] = Math.ceil((300 * Math.sin(count * (Math.PI / 180)) + 300));

            gContext.set("EnOceanSimulator", EnOceanSim)
        };
        
        function string2wordArray(string, encode) {
            let value= new Array(20);
            value.fill(0);
            let buf = iconv.encode(string, encode);
            let length = buf.length;
            buf = Buffer.concat([buf, Buffer.alloc(1, 0)]);
            buf.writeUInt8(0, buf.length - 1);
            for (let i = 0; i < length; i += 2) {
                value[i / 2] = buf.readUInt16LE(i);
            }
            return value;
        };
    }

    RED.nodes.registerType("EnOcean-sim",EnOceanSim);
}
