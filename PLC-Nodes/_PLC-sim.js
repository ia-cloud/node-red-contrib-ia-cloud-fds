
"use strict";

const iconv = require("iconv-lite");

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

    function PLCSim(config) {
        RED.nodes.createNode(this, config);

        const node = this;
        const minCycle = 1; // 最小収集周期を1秒に設定
        // 定期更新のためのカウンターをセット
        let interval = parseInt(config.interval);
        let timeCount = interval;
        // Nodeステータスを　Readyに
        node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        if (interval !== 0) {
            let count = 0;
            let gContext = this.context().global;

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
            let PLCSim = gContext.get ("PLCSimulator");
            if(!PLCSim) PLCSim = {mitsubishi:{}, modbus:{}};

            let count60 = count % 60;
            let count600= count % (10 * 60);
            let count3600 = count % (60 * 60);
            let countMax = count;

            let countData = {
                start: W_START,
                num: 4,
                value:[count60 & 0xffff, count600 & 0xffff, count3600 & 0xffff, countMax & 0xffff]
            };

            let countDWData = { 
                start: DW_START,
                num: 8,
                value: [
                    count60 & 0xffff, count60 >>> 16, count600 & 0xffff, count600 >>> 16,
                    count3600 & 0xffff, count3600 >>> 16, countMax & 0xffff, countMax >>> 16
                ]
            };

            let bitValue = [];
            for (let i = 0 ; i < 16 ; i++) {
                bitValue[i] = !!((countMax >>> i) & 1);
            } 
            let bitData = {
                start: B_START,
                num: 16,
                value: bitValue
            };

            let alarmValue = [];
            alarmValue[0] = (count60 > 5 && count60 < 15);
            alarmValue[1] = (count600 > 30 && count600 < 60);
            alarmValue[2] = (count3600 > 500 && count3600 < 800);
            alarmValue[3] = (countMax > 8000 && countMax < 12000);
            let alarmData = {
                start: A_START,
                num: 4,
                value: alarmValue
            };
            let buf;
            let sJISValue = new Array(16);
            sJISValue.fill(0);
            buf = iconv.encode(TEST_STRING, "shift-jis");
            buf.writeUInt8(0, buf.length - 1);
            for (let i = 0, v = 0; i < buf.length; i += 2) {
                sJISValue[i / 2] = buf.readUInt16LE(i);
            }
            let sJISData = {
                start: SJIS_START,
                num: 16,
                value: sJISValue
            };
            let EUCValue = new Array(16);
            EUCValue.fill(0);
            buf = iconv.encode(TEST_STRING, "EUC-JP");
            buf.writeUInt8(0, buf.length - 1);
            for (let i = 0, v = 0; i < buf.length; i += 2) {
                EUCValue[i / 2] = buf.readUInt16LE(i);
            }
            let EUCData = {
                start: EUC_START,
                num: 16,
                value: EUCValue
            };

            let utfValue = new Array(16);
            utfValue.fill(0);
            buf = iconv.encode(TEST_STRING, "utf-8");
            buf.writeUInt8(0, buf.length - 1);
            for (let i = 0, v = 0; i < buf.length; i += 2) {
                utfValue[i / 2] = buf.readUInt16LE(i);
            }
            let utfData = {
                start: UTF_START,
                num: 16,
                value: utfValue
            };

            let omronPVetc = {
                start: 0x2402,
                num: 16,
                value: [count600, 1800, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1 ]
            };
            let omronPID = {
                start: 0x2a00,
                num: 3,
                value: [80, 233, 40]
            };
            let omronDP = {
                start: 0x3309,
                num: 1,
                value: [0]
            }

            PLCSim.modbus["HR"] = [];
            PLCSim.modbus["HR"].push(countData);
            PLCSim.modbus["HR"].push(countDWData);
            PLCSim.modbus["HR"].push(sJISData);
            PLCSim.modbus["HR"].push(EUCData);
            PLCSim.modbus["HR"].push(utfData);
            PLCSim.modbus["HR"].push(omronPVetc);
            PLCSim.modbus["HR"].push(omronPID);
            PLCSim.modbus["HR"].push(omronDP);


            PLCSim.modbus["IS"] = [];
            PLCSim.modbus["IS"].push(bitData);
            PLCSim.modbus["IS"].push(alarmData);
        
            PLCSim.mitsubishi["D"] = [];
            PLCSim.mitsubishi["D"].push(countData);
            PLCSim.mitsubishi["D"].push(countDWData);
            PLCSim.mitsubishi["D"].push(sJISData);
            PLCSim.mitsubishi["D"].push(EUCData);
            PLCSim.mitsubishi["D"].push(utfData);

            PLCSim.mitsubishi["M"] = [];
            PLCSim.mitsubishi["M"].push(bitData);
            PLCSim.mitsubishi["M"].push(alarmData);

            gContext.set("PLCSimulator", PLCSim)
        };
    }

    RED.nodes.registerType("PLC-sim",PLCSim);
}
