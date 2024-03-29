/**
 * Copyright 2019 ia-cloud project
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

module.exports = function(RED) {
    "use strict";
    var settings = RED.settings;
    var events = require("events");
    var serialp = require("serialport");
    var moment = require("moment");
    var fs = require("fs");
    
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
        
        this.serialpool = serialPool;     // ここでserialPoolをこのNodeのプロパティにする
    }
    RED.nodes.registerType("ia-cloud-serialport",SerialPortNode);

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

    RED.httpAdmin.get('/serialports', RED.auth.needsPermission('serial.read'), function(req, res) {
        serialp.list()
            .then(function(data) {
                // data = [{"path":"COM3","manufacturer":"FTDI","serialNumber":"FT2L5LDF","pnpId":"FTDIBUS\\VID_0403+PID_6001+FT2L5LDFA\\0000","vendorId":"0403","productId":"6001"}]
                res.json(data.map(d => d.path));
            })
            .catch(function(err) {
                console.error(err);
                // res.json([RED._('serial.errors.list')]);
            });
    });
}
