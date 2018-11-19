module.exports = function(RED) {
    "use strict";
    var settings = RED.settings;
    var events = require("events");
    var serialp = require("serialport");
    //var crc = require("crc");
    //const { crc81wire } = require('crc');
    const CRC = require('crc-full').CRC;
    var bufMaxSize = 32768;  // Max serial buffer size, for inputs...
    var gEnOceanData = "";
    
    // TODO: 'serialPool' should be encapsulated in SerialPortNode

    // Configuration Node
    function SerialPortNode(n) {
        RED.nodes.createNode(this,n);
        this.serialport = n.serialport;
        this.newline = n.newline; /* overloaded: split character, timeout, or character count */
        this.addchar = n.addchar || "false";
        this.serialbaud = parseInt(n.serialbaud) || 57600;
        this.databits = parseInt(n.databits) || 8;
        this.parity = n.parity || "none";
        this.stopbits = parseInt(n.stopbits) || 1;
        this.bin = n.bin || "false";
        this.out = n.out || "char";
        this.responsetimeout = n.responsetimeout || 10000;
    }
    RED.nodes.registerType("serial-port",SerialPortNode);

    // Configuration Node (link-data-object)
    function LinkDataObjectNode(n) {
        RED.nodes.createNode(this,n);
        var index = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
        var prop_s = "";
        var prop_n = "";
        var gContext = this.context().global;
        var common_info = [];
        
        for( var item of index ){
            var element = {sensor:"", notify:"", endata:""};
            prop_s = 'sensor_' + item;
            prop_n = 'notify_' + item;
            this[prop_s] = n[prop_s];
            this[prop_n] = n[prop_n];
            element.sensor = n[prop_s];
            //this.log('element.sensor = ' + element.sensor);
            if (n[prop_n] == undefined) {
                element.notify = "false";
            } else {
                element.notify = n[prop_n];
            }
            element.endata = "";
            common_info.push(element);
        }
        gContext.set("common_info", common_info);
        this.entry_sensor = n.entry_sensor;
        
        // コンテキストデータの確認
        var cur_com_info = gContext.get("common_info");
        this.log('current common_info = ' + JSON.stringify(cur_com_info));

        //this.on("close", function() {
        //    var common_info = null;
        //    fContext.set("common_info", common_info);
        //});
    }
    RED.nodes.registerType("link-data-object",LinkDataObjectNode);

    function ParseHeader(header) {
        // ERP2 Header Check
        var result = {orgid_len:0, destid_len:0, ext_hdr:false, telegram_type:"", RORG:"", ext_tlg:false};
        var dec = parseInt(header,16);

        // Check address control
        var addr_ctl = dec >> 5;
        if (addr_ctl == 0) {
            result['orgid_len'] = 3;
            result['destid_len'] = 0;
        } else if (addr_ctl == 1) {
            result['orgid_len'] = 4;
            result['destid_len'] = 0;
        } else if (addr_ctl == 2) {
            result['orgid_len'] = 4;
            result['destid_len'] = 4;
        } else if (addr_ctl == 3) {
            result['orgid_len'] = 6;
            result['destid_len'] = 0;
        } else {
            result['orgid_len'] = 0;
            result['destid_len'] = 0;
        }
        // Check if Extended header is available
        if (dec & 0x10) {
            result['ext_hdr'] = true;
        } else {
            result['ext_hdr'] = false;
        }
        // Check the Telegram type(R-ORG), Extended Telegram type field
        var telegram_type = dec & 0x0f;
        if (telegram_type == 0) {
            result['telegram_type'] = 'RPS';
            result['RORG'] = '0xF6';
            result['ext_tlg'] = false;
        } else if (telegram_type == 1) {
            result['telegram_type'] = '1BS';
            result['RORG'] = '0xD5';
            result['ext_tlg'] = false;
        } else if (telegram_type == 2) {
            result['telegram_type'] = '4BS';
            result['RORG'] = '0xA5';
            result['ext_tlg'] = false;
        } else if (telegram_type == 4) {
            result['telegram_type'] = 'VLD';
            result['RORG'] = '0xD2';
            result['ext_tlg'] = false;
        } else if (telegram_type == 15) {
            result['telegram_type'] = 'EXT';
            result['RORG'] = '0x00';
            result['ext_tlg'] = true;
        } else {
            result['telegram_type'] = 'RSV';
            result['RORG'] = '0x00';
            result['ext_tlg'] = false;
        }
        return result;
    }

    function ParseData(data, data_len, header_info) {
        var result = {header:null, ext_hdr:null, ext_tlg:null, originId:null, destId:null, radio_data:null};
        var index = 0;
        // Check a length of radio data.
        if (data.length < data_len*2) {
            return null;
        }
        
        result['header'] = data.slice(0,2);
        index += 2;

        if (header_info['ext_hdr']) {
            result['ext_hdr'] = data.slice(index,index+2);
            index += 2;
        } else {
            result['ext_hdr'] = null;
        }

        if (header_info['ext_tlg']) {
            result['ext_tlg'] = data.slice(index,index+2);
            index += 2;
        } else {
            result['ext_tlg'] = null;
        }

        if (header_info['orgid_len'] > 0) {
            result['originId'] = data.slice(index, index + (header_info['orgid_len'] * 2));
            index += (header_info['orgid_len'] * 2);
        } else {
            result['originId'] = null;
        }

        if (header_info['destid_len'] > 0) {
            result['destId'] = data.slice(index, index + (header_info['destid_len'] * 2));
            index += (header_info['destid_len'] * 2);
        } else {
            result['destId'] = null;
        }

        if ((header_info['telegram_type'] == 'RPS') || (header_info['telegram_type'] == '1BS')) {
            result['radio_data'] = data.slice(index, index+2);
            index += 2;
        } else if (header_info['telegram_type'] == '4BS') {
            result['radio_data'] = data.slice(index, index+8);
            index += 8;
        } else if (header_info['telegram_type'] == 'VLD') {
            result['radio_data'] = null;      // Does not use VLD type
        } else if (header_info['telegram_type'] == 'EXT') {     // Extended Telegram-Type is available
            if (result['ext_tlg'] != null && parseInt(result['ext_tlg'],16) == 7) {    // GPの場合
                result['radio_data'] = data.slice(index, index+10);
                index += 10;
            } else {
                result['radio_data'] = null;
            }
        } else {
            result['radio_data'] = null;    // その他のTypeは解析しない
        }

        return result;
    }

    // EnOcean-com node function definition
    function EnOceanComNode(n) {
        RED.nodes.createNode(this,n);
        this.serial = n.serial;
        this.serialConfig = RED.nodes.getNode(this.serial);
        this.linkdataobj = n.linkdataobj;
        this.linkdataobjConfig = RED.nodes.getNode(this.linkdataobj);
        var gContext = this.context().global;
        var node = this;

        if (this.serialConfig) {
            var node = this;
            node.status({fill:"grey",shape:"dot",text:"node-red:common.status.not-connected"});
            node.port = serialPool.get(this.serialConfig);
            
            this.port.on('data', function(msgout) {
                node.status({fill:"yellow",shape:"dot",text:"データ受信済み"});
                
                var en_data = Buffer.from(msgout.payload).toString('hex');
                node.log(en_data);
                //node.send(msgout);
                
                if (en_data.substr(0,2) != "55") {
                    node.log('Received data is invalid. The start data is not 0x55.');
                    return;
                }
                var data_len = parseInt(en_data.substr(2,4),16);
                var opt_len = parseInt(en_data.substr(6,2),16);
                node.log('EnOcean data length = ' + data_len);
                if (data_len <= 6) {
                    node.log('Data length is less than 6 bytes. Enocean signal is too short. skip...');
                    return;
                }
                if (en_data.substr(8,2) != "0a") {
                    node.log('Packet type is not 10 (RADIO_ERP2). This data is discarded.');
                    return;
                }
                // Header CRC Check
                var header = en_data.substr(2,8);
                //node.log('header = ' + header);
                //var calc_crc = crc8(header).toString(16);
                var crc = new CRC("CRC8", 8, 0x07, 0x00, 0x00, false, false);
                var calc_crc = crc.compute(Buffer.from(header, 'hex')).toString(16);
                var head_crc = en_data.substr(10,2);
                if (calc_crc != head_crc) {
                    node.log('Check Header CRC....NG!! This data is discarded.');
                    node.log('head_crc = ' + head_crc + '  calc_crc = ' + calc_crc);
                    return;
                } else {
                    node.log('Check Header CRC.... OK!!  header crc = ' + head_crc + '  compute crc = ' + calc_crc);
                }
                // Data CRC Check
                var pos_crc = 12 + (data_len + opt_len) * 2;
                var check_str = en_data.substr(12,(data_len+opt_len)*2);
                var data_crc = en_data.substr(pos_crc,2);
                calc_crc = crc.compute(Buffer.from(check_str, 'hex')).toString(16);
                if (calc_crc != data_crc) {
                    node.log('Check Data CRC....NG!! This data is discarded.');
                    node.log('data_crc = ' + data_crc + '  calc_crc = ' + calc_crc);
                    return;
                } else {
                    node.log('Check Data CRC....OK!!  data crc = ' + data_crc + '  compute crc = ' + calc_crc);
                }
                
                var erp2_hdr = en_data.substr(12,2);
                node.log('erp2_hdr = ' + erp2_hdr);
                var header_info = ParseHeader(erp2_hdr);
                var data = en_data.substr(12, data_len*2);
                var data_info = ParseData(data, data_len, header_info);

                if (data_info.originId != null) {
                    node.log('Originator ID = ' + data_info.originId);
                } else {
                    node.log('Originator ID = ---');
                    node.log('parse error : Can not find Originator-ID, so this packet is discarded.');
                    return;
                }
                node.log('radio data = ' + data_info.radio_data);
                
                // Originator-ID and radio data is set into the global context.
                var common_info = gContext.get("common_info");
                var IsSetData = false;
                for(let i = 0; i < common_info.length; i++) {
                    if (common_info[i].sensor == data_info.originId) {
                        common_info[i].endata = data_info.radio_data;
                        IsSetData = true;
                    }
                }
                if (!IsSetData) {
                    node.log('Can not find sensor id in context data!!');
                }
                
                var new_msg = { payload: data_info.originId };
                node.send(new_msg);
                
            });
            this.port.on('ready', function() {
                node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
            });
            this.port.on('closed', function() {
                node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
            });
        }
        else {
            this.error(RED._("serial.errors.missing-conf"));
        }

        this.on("close", function(done) {
            if (this.serialConfig) {
                serialPool.close(this.serialConfig.serialport,done);
            }
            else {
                done();
            }
        });
    }
    RED.nodes.registerType("EnOcean-com",EnOceanComNode);

    // 温度計算をする
    function calc_temperature(data){
        var ret = [];
        if (data.length < 5*2) {
            // 5Byte以上でなければ空リスト返却
            return ret;
        }
        var dec = parseInt(data, 16);
        var tempList = [];
        for (var num = 3; num >= 0; num--) {
            var ch_val = (dec >> 10*num) & 0b1111111111;
            console.log('ch_val = ' + ch_val);
            var temp = 130.0 - (parseFloat(ch_val) / 1024.0 * 170.0);
            tempList.push(temp);
        }

        return tempList;
    }

    // 電流計算をする
    function calc_ac(data){
        var ret = [];
        if (data.length < 4*2) {
            // 4Byte以上でなければ空リスト返却
            return ret;
        }
        var dec = parseInt(data, 16);
        var acList = [];
        var ch_val = (dec >> 8) & 0b1111111111;
        var ad_val = parseInt(ch_val,2);
        var K = 0;
        if (ad_val < 9) {
            K = (-0.0448 * ad_val) + 1.77;
        } else if (ad_val >= 9 && ad_val < 20) {
            K = (-0.0114 * ad_val) + 1.46;
        } else if (ad_val >= 20 && ad_val < 227) {
            K = (-0.000433 * ad_val) + 1.25;
        } else if (ad_val >= 227 && ad_val < 822) {
            K = (0.0000218 * ad_val) + 1.15;
        } else {
            K = (0.000365 * ad_val) + 0.86;
        }

        var E = 1.76;
        // CT径が10mm なのでc, d は以下の数値
        var c = 56;
        var d = 3000;

        var I = (ad_val * K * E * d)/(2.8 * c);
        var ac = I / 1000;
        acList.push(ac);

        return acList;
    }

    // EnOcean-obj node function definition
    function EnOceanObjNode(n) {
        RED.nodes.createNode(this,n);
        this.sensor_id = n.sensor_id;
        this.sensor_kind = n.sensor_kind;
        this.linkdataobj = n.linkdataobj;
        var gContext = this.context().global;
        var node = this;
        
        this.on("input", function(msg) {
            var sensor_id = msg.payload;
            var common_info = gContext.get("common_info");
            var en_data = "";
            
            if (node.sensor_id == sensor_id) {
                node.log('Match the sensor-ID of this node [' + node.sensor_id + ' : ' + sensor_id + ']');
            } else {
                node.log('Does not match the sensor-ID of this node [' + node.sensor_id + ' : ' + sensor_id + ']');
                return;
            }

            for(let i = 0; i < common_info.length; i++) {
                if (common_info[i].sensor == sensor_id) {
                    en_data = common_info[i].endata;
                    break;
                }
            }
            node.log('get endata from global context "common_info" : ' + en_data);
            if (node.sensor_kind == "u-rd") {
               var value = calc_ac(en_data);
               node.log('calculate ac value = ' + value);
            } else {
               var value = calc_temperature(en_data);
               node.log('calculate temp value = ' + value);
            }
            var new_msg = { payload: value };
            node.send(new_msg);
            node.status({fill:"blue",shape:"dot",text:"データ送信済み"});
        });

        this.on("close", function(done) {
            if (this.serialConfig) {
                serialPool.close(this.serialConfig.serialport,done);
            }
            else {
                done();
            }
        });
    }
    RED.nodes.registerType("EnOcean-obj",EnOceanObjNode);
    
    var serialPool = (function() {
        var connections = {};
        return {
            get:function(serialConfig) {
                // make local copy of configuration -- perhaps not needed?
                var port      = serialConfig.serialport,
                    baud      = serialConfig.serialbaud,
                    databits  = serialConfig.databits,
                    parity    = serialConfig.parity,
                    stopbits  = serialConfig.stopbits,
                    newline   = serialConfig.newline,
                    spliton   = serialConfig.out,
                    binoutput = serialConfig.bin,
                    addchar   = serialConfig.addchar,
                    responsetimeout = serialConfig.responsetimeout;
                var id = port;
                // just return the connection object if already have one
                // key is the port (file path)
                if (connections[id]) { return connections[id]; }

                // State variables to be used by the on('data') handler
                var i = 0; // position in the buffer
                // .newline is misleading as its meaning depends on the split input policy:
                //   "char"  : a msg will be sent after a character with value .newline is received
                //   "time"  : a msg will be sent after .newline milliseconds
                //   "count" : a msg will be sent after .newline characters
                // if we use "count", we already know how big the buffer will be
                var bufSize = spliton == "count" ? Number(newline): bufMaxSize;
                var buf = new Buffer(bufSize);

                var splitc; // split character
                // Parse the split character onto a 1-char buffer we can immediately compare against
                if (newline.substr(0,2) == "0x") {
                    splitc = new Buffer([parseInt(newline)]);
                }
                else {
                    splitc = new Buffer(newline.replace("\\n","\n").replace("\\r","\r").replace("\\t","\t").replace("\\e","\e").replace("\\f","\f").replace("\\0","\0")); // jshint ignore:line
                }

                connections[id] = (function() {
                    var obj = {
                        _emitter: new events.EventEmitter(),
                        serial: null,
                        _closing: false,
                        tout: null,
                        queue: [],
                        on: function(a,b) { this._emitter.on(a,b); },
                        close: function(cb) { this.serial.close(cb); },
                        encodePayload: function (payload) {
                            if (!Buffer.isBuffer(payload)) {
                                if (typeof payload === "object") {
                                    payload = JSON.stringify(payload);
                                }
                                else {
                                    payload = payload.toString();
                                }
                                if ((spliton === "char") && (addchar === true)) { payload += splitc; }
                            }
                            else if ((spliton === "char") && (addchar === true) && (splitc !== "")) {
                                payload = Buffer.concat([payload,splitc]);
                            }
                            return payload;
                        },
                        write: function(m,cb) { this.serial.write(m,cb); },
                        enqueue: function(msg,sender,cb) {
                            var payload = this.encodePayload(msg.payload);
                            var qobj = {
                                sender: sender,
                                msg: msg,
                                payload: payload,
                                cb: cb,
                            }
                            this.queue.push(qobj);
                            // If we're enqueing the first message in line,
                            // we shall send it right away
                            if (this.queue.length === 1) {
                                this.writehead();
                            }
                        },
                        writehead: function() {
                            if (!this.queue.length) { return; }
                            var qobj = this.queue[0];
                            this.write(qobj.payload,qobj.cb);
                            var msg = qobj.msg;
                            var timeout = msg.timeout || responsetimeout;
                            this.tout = setTimeout(function () {
                                this.tout = null;
                                var msgout = obj.dequeue() || {};
                                msgout.port = port;
                                // if we have some leftover stuff, just send it
                                if (i !== 0) {
                                    var m = buf.slice(0,i);
                                    m = Buffer.from(m);
                                    i = 0;
                                    if (binoutput !== "bin") { m = m.toString(); }
                                    msgout.payload = m;
                                }
                                /* Notify the sender that a timeout occurred */
                                obj._emitter.emit('timeout',msgout,qobj.sender);
                            }, timeout);
                        },
                        dequeue: function() {
                            // if we are trying to dequeue stuff from an
                            // empty queue, that's an unsolicited message
                            if (!this.queue.length) { return null; }
                            var msg = Object.assign({}, this.queue[0].msg);
                            msg = Object.assign(msg, {
                                request_payload: msg.payload,
                                request_msgid: msg._msgid,
                            });
                            delete msg.payload;
                            if (this.tout) {
                                clearTimeout(obj.tout);
                                obj.tout = null;
                            }
                            this.queue.shift();
                            this.writehead();
                            return msg;
                        },
                    }
                    //newline = newline.replace("\\n","\n").replace("\\r","\r");
                    var olderr = "";
                    var setupSerial = function() {
                        obj.serial = new serialp(port,{
                            baudRate: baud,
                            dataBits: databits,
                            parity: parity,
                            stopBits: stopbits,
                            //parser: serialp.parsers.raw,
                            autoOpen: true
                        }, function(err, results) {
                            if (err) {
                                if (err.toString() !== olderr) {
                                    olderr = err.toString();
                                    RED.log.error(RED._("serial.errors.error",{port:port,error:olderr}));
                                }
                                obj.tout = setTimeout(function() {
                                    setupSerial();
                                }, settings.serialReconnectTime);
                            }
                        });
                        obj.serial.on('error', function(err) {
                            RED.log.error(RED._("serial.errors.error",{port:port,error:err.toString()}));
                            obj._emitter.emit('closed');
                            obj.tout = setTimeout(function() {
                                setupSerial();
                            }, settings.serialReconnectTime);
                        });
                        obj.serial.on('close', function() {
                            if (!obj._closing) {
                                RED.log.error(RED._("serial.errors.unexpected-close",{port:port}));
                                obj._emitter.emit('closed');
                                obj.tout = setTimeout(function() {
                                    setupSerial();
                                }, settings.serialReconnectTime);
                            }
                        });
                        obj.serial.on('open',function() {
                            olderr = "";
                            RED.log.info(RED._("serial.onopen",{port:port,baud:baud,config: databits+""+parity.charAt(0).toUpperCase()+stopbits}));
                            if (obj.tout) { clearTimeout(obj.tout); obj.tout = null; }
                            //obj.serial.flush();
                            obj._emitter.emit('ready');
                        });

                        obj.serial.on('data',function(d) {
                            function emitData(data) {
                                var m = Buffer.from(data);
                                var last_sender = null;
                                if (obj.queue.length) { last_sender = obj.queue[0].sender; }
                                if (binoutput !== "bin") { m = m.toString(); }
                                var msgout = obj.dequeue() || {};
                                msgout.payload = m;
                                msgout.port = port;
                                obj._emitter.emit('data',
                                    msgout,
                                    last_sender);
                            }

                            for (var z=0; z<d.length; z++) {
                                var c = d[z];
                                // handle the trivial case first -- single char buffer
                                if ((newline === 0)||(newline === "")) {
                                    emitData(new Buffer([c]));
                                    continue;
                                }

                                // save incoming data into local buffer
                                buf[i] = c;
                                i += 1;

                                // do the timer thing
                                if (spliton === "time" || spliton === "interbyte") {
                                    // start the timeout at the first character in case of regular timeout
                                    // restart it at the last character of the this event in case of interbyte timeout
                                    if ((spliton === "time" && i === 1) ||
                                        (spliton === "interbyte" && z === d.length-1)) {
                                        // if we had a response timeout set, clear it:
                                        // we'll emit at least 1 character at some point anyway
                                        if (obj.tout) {
                                            clearTimeout(obj.tout);
                                            obj.tout = null;
                                        }
                                        obj.tout = setTimeout(function () {
                                            obj.tout = null;
                                            emitData(buf.slice(0, i));
                                            i=0;
                                        }, newline);
                                    }
                                }
                                // count bytes into a buffer...
                                else if (spliton === "count") {
                                    if ( i >= parseInt(newline)) {
                                        emitData(buf.slice(0,i));
                                        i=0;
                                    }
                                }
                                // look to match char...
                                else if (spliton === "char") {
                                    if ((c === splitc[0]) || (i === bufMaxSize)) {
                                        emitData(buf.slice(0,i));
                                        i=0;
                                    }
                                }
                            }
                        });
                        // obj.serial.on("disconnect",function() {
                        //     RED.log.error(RED._("serial.errors.disconnected",{port:port}));
                        // });
                    }
                    setupSerial();
                    return obj;
                }());
                return connections[id];
            },
            close: function(port,done) {
                if (connections[port]) {
                    if (connections[port].tout != null) {
                        clearTimeout(connections[port].tout);
                    }
                    connections[port]._closing = true;
                    try {
                        connections[port].close(function() {
                            RED.log.info(RED._("serial.errors.closed",{port:port}));
                            done();
                        });
                    }
                    catch(err) { }
                    delete connections[port];
                }
                else {
                    done();
                }
            }
        }
    }());

    RED.httpAdmin.get("/serialports", RED.auth.needsPermission('serial.read'), function(req,res) {
        serialp.list(function (err, ports) {
            res.json(ports);
        });
    });
    
    RED.httpAdmin.get("/endata", function(req,res) {
        var recv_data = gEnOceanData;
        var data_json = {
            endata: recv_data
        };
        res.json(data_json);
    });
}