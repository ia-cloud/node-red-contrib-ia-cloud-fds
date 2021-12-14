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

const WebSocket = require('ws')
const Lisp = require('./lispparse.js');

/****** DHWebSocket.js/DataHubWebSocket
 * NAME
 * DHWebSocket.js -- Real-time data via a WebSocket connection.
 *
 * AUTHOR
 * Andrew Thomas, Cogent Real-Time Systems
 *
 * SYNOPSIS
 * To use this, create a new DataHubWebSocket:
 *
 *    var dhws = new DataHubWebSocket(host, port, is_ssl);
 *
 * Add handlers for connect and disconnect:
 *    dhws.onConnectionFailure = function (host, port) { }
 *    dhws.onConnectionSuccess = function (host, port) { }
 *
 * Add handlers for any messages you want to handle:
 *    dhws.handlers["point"] = function (args) { }
 *    dhws.handlers["echo"] = function (args) { }
 *    dhws.handlers["success"] = function (args) { }
 *    dhws.handlers["error"] = function (args) { }
 *
 * You can hook any message that could come from the DataHub, including
 * responses to outgoing messages.
 *
 * Any message for which you have not defined an explicit handler will be
 * sent to the handlers for "AsyncMessage":
 *    dhws.handlers["AsyncMessage"] = function (args) { do_something(); }
 ******
 */

/****c* DataHubWebSocket/Constructor
 * NAME
 * DataHubWebSocket
 *
 * SYNOPSIS
 * Create a DataHubWebSocket object.
 *   dhws = new DataHubWebSocket(host, port, is_ssl);
 *
 * INPUTS
 *   * host - The name or IP address of the host to connect.
 *   * port - The port number on which to connect.
 *   * is_ssl - If true, use SSL (wss://) when connecting.
 *
 * RESULT
 * An instance of DataHubWebSocket
 ******
 */
module.exports = function(host, port, is_ssl) {
    /****m* DataHubWebSocket/onConnectionFailure
     * NAME
     * onConnectionFailure
     *
     * SYNOPSIS
     * A function to run when a connection attempt fails or when an existing connection is disconnected.
     *
     * INPUTS
     *   * host - The name of the target host
     *   * port - The port number on the target host
     ******/
    this.onConnectionFailure = null;

    /****m* DataHubWebSocket/onConnectionSuccess
     * NAME
     * onConnectionSuccess
     *
     * SYNOPSIS
     * A function to run when a connection attempt succeeds.
     *
     * INPUTS
     *   * host - The name of the target host
     *   * port - The port number on the target host
     ******/
    this.onConnectionSuccess = null;

    /****v* DataHubWebSocket/retryDelay
     * NAME
     * retryDelay
     * SYNOPSIS
     * The number of milliseconds to wait after a lost connection before trying to reconnect.
     ******/
    this.retryDelay = 5000;

    /****v* DataHubWebSocket/heartbeat
     * NAME
     * heartbeat
     * SYNOPSIS
     * The rate in milliseconds to send a heartbeat message.  Zero means no heartbeat.
     ******/
    this.heartbeat = 10000;

    /***** DataHubWebSocket/timeout
     * NAME
     * timeout
     * SYNOPSIS
     * The number of milliseconds of no activity on the connection before automatically disconnecting.
     ******/
    this.timeout = 30000;

    this.haveData = false;

    this.username = null;
    this.password = null;
    
    /*
     * Used internally
     */
    this.ws = null;
    this.host = host;
    this.port = port;
    this.isSSL = is_ssl;

    this.handlers = new Object();
    this.interval = null;

    var _this = this;

    /***** DataHubWebSocket/send
     * NAME
     * send
     * SYNOPSIS
     * Transmit a string to the server through the WebSocket
     * INPUTS
     *   * string - The string to transmit.  This function will automatically add a newline character to the provided string.
     ******/
    this.send = function (string) {
        if (this.ws && this.ws.readyState == this.ws.OPEN) {
            this.ws.send(string + "\n");
        }
    };

    this.setAuth = function(username, password) {
        this.username = username;
        this.password = password;
    };

    this.setHeartbeat = function(heartbeat, timeout) {
        this.heartbeat = heartbeat;
        this.timeout = timeout;
    };
    
    // Set up the connection.

    this.tryConnect = function () {
        if (!WebSocket) {
            alert('WebSockets are NOT supported by your browser.');
            return;
        }

        var hostname = this.host;
        if (this.port)
            hostname += ":" + this.port;
        var protocol = (this.isSSL ? "wss" : "ws");

        this.ws = new WebSocket(protocol + '://' + hostname + '/websocket');
        this.ws.dhws = this;

        this.ws.onopen = function () {
            var ws = this.dhws;
            if (ws.username && ws.password)
            ws.send("(auth " + ws.escaped(ws.username, true) + " " +
                ws.escaped(ws.password, true) + ")");
            ws.send("(acksuccess 0)");
            ws.send("(heartbeat " + ws.heartbeat + ")");
            ws.send("(timeout " + ws.timeout + ")");
            ws.startAliveTimer();
            if (ws.onConnectionSuccess)
                ws.onConnectionSuccess(ws.host, ws.port);
            ws.reregisterPoints();
            ws.reregisterDomains();
        };

        this.eventno = 0;
    
        this.ws.onmessage = function (e) {
            this.dhws.haveData = true;
            this.dhws.process(e.data);
        };

        this.ws.onclose = function () {
            this.dhws.stopAliveTimer();
            if (this.dhws.onConnectionFailure)
                this.dhws.onConnectionFailure(this.dhws.host, this.dhws.port);
        };

        this.ws.onerror = function (e) {
            this.dhws.stopAliveTimer();
            if (this.dhws.onConnectionError)
                this.dhws.onConnectionError(this.dhws.host, this.dhws.port, e);
        };
    };

    // Set up a timer to try to connect every retryDelay milliseconds.
    // If the connection is in process, do nothing except restart the timer.
    this.connectionTimer = function () {
        if (!this.ws || this.ws.readyState == this.ws.CLOSED) {
            this.tryConnect();
        }
    };

    this.aliveTimer = function() {
        this.send("(alive)");
    }

    this.timeoutTimer = function() {
        if (!this.haveData && this.ws
            && this.ws.readyState != this.ws.CLOSED
            && this.ws.readyState != this.ws.CLOSING) {
                this.ws.close();
        }
        this.haveData = false;
    }
    
    this.startAliveTimer = function() {
        if (this.ws && this.ws.readyState == this.ws.OPEN) {
            if (this.heartbeat > 0)
            this.aliveInterval = setInterval(function () { _this.aliveTimer(); }, this.heartbeat);
            if (this.timeout > 0)
            this.timeoutInterval = setInterval(function () { _this.timeoutTimer(); }, this.timeout);
        }
    }

    this.stopAliveTimer = function() {
        if (this.aliveInterval) {
            clearInterval(this.aliveInterval);
            this.aliveInterval = null;
        }
        if (this.timeoutInterval) {
            clearInterval(this.timeoutInterval);
            this.timeoutInterval = null;
        }
    }

    this.connect = function (host, port, is_ssl) {
        if (this.ws &&
            (this.ws.readyState == this.ws.OPEN
             || this.ws.readyState == this.ws.CONNECTING)
            ) {
            // Do nothing.  It is already connected.
        }
        else {
            this.host = host;
            this.port = port;
            if (typeof (is_ssl) === "undefined")
                is_ssl = (window.location.protocol.lastIndexOf("https", 0) === 0);
            this.isSSL = is_ssl;
            this.disconnect();
            this.interval = setInterval(function () { _this.connectionTimer(); }, 5000);
            this.tryConnect();
        }
    };

    this.disconnect = function () {
        this.stopAliveTimer();
        if (this.ws && this.ws.readyState != this.ws.CLOSED)
            this.ws.close();
        if (this.interval)
            clearInterval(this.interval);
        this.interval = null;
    };

    // Add and remove handlers for individual points
    this.pointHandlers = new Array();

    this.addPointHandler = function (pointname, handler) {
        if (!this.pointHandlers[pointname])
            this.pointHandlers[pointname] = new Array();
        this.pointHandlers[pointname][this.pointHandlers[pointname].length] = handler;
    };

    this.removePointHandler = function (pointname, handler) {
        if (this.pointHandlers[pointname]) {
            var key;
            for (key in this.pointHandlers[pointname]) {
                if (this.pointHandlers[pointname][key] == handler) {
                    this.pointHandlers[pointname].splice(key, 1);
                }
            }
        }
    };

    this.runPointHandlers = function (pointname, args) {
        var handlers = this.pointHandlers[pointname];
        var catchall = this.pointHandlers["*"];

        this.runPointHandlerList(handlers, args);
        this.runPointHandlerList(catchall, args);
    };

    this.runPointHandlerList = function (handlers, args) {
        if (handlers && handlers.length > 0) {
            handlers.forEach(function (x) {
                try {
                    x(args);
                }
                catch (e) {
                    // log the error.
                }
            });
        }
    };

    this.handlers["point"] = function (args) {
        _this.runPointHandlers(args[1], args);
    };

    this.handlers["echo"] = this.handlers["point"];

    // When the user registers points and domains we need to keep track of
    // what has been registered so that we can re-register if the link is
    // broken and then reconnected.

    this.registeredPoints = new Object();

    // This is a hash of all domains that are registered.  The value of the hash
    // is either false (or undefined), or it is a string containint registration
    // flags, like "0x07"
    this.registeredDomains = new Object();

    this.registerPoint = function (name) {
        var val = this.registeredPoints[name];
        if (val === undefined || val == false) {
            this.registeredPoints[name] = true;
            this.send("(creport " + this.escaped(name, true) + ")");
        }
    };

    this.registerDomain = function (name, onceonly) {
        var val = this.registeredDomains[name];
        if (onceonly === undefined)
            onceonly = false;
        var flags = onceonly ? "0x0f" : "0x07";
        if (!val) {
            this.registeredDomains[name] = flags;
            this.send("(report_domain " + this.escaped(name, true) + " " + flags + ")");
        }
    };

    this.unregisterPoint = function (name) {
        var val = this.registeredPoints[name];
        if (val) {
            this.registeredPoints[name] = false;
            this.send("(unreport " + this.escaped(name, true) + ")");
        }
    };

    this.unregisterDomain = function (name) {
        var val = this.registeredDomains[name];
        if (val) {
            this.registeredDomains[name] = false;
            this.send("(unreport_domain " + this.escaped(name, true) + ")");
        }
    };

    this.unregisterAllPoints = function () {
        var name;
        for (name in this.registeredPoints) {
        this.unregisterPoint(name);
        }
    };

    this.reregisterPoints = function () {
        var name;
        for (name in this.registeredPoints) {
            if (this.registeredPoints[name] == true) {
                this.send("(creport " + this.escaped(name, true) + ")");
            }
        }
    };

    this.reregisterDomains = function () {
        var name;
        for (name in this.registeredDomains) {
            if (this.registeredDomains[name]) {
                this.send("(report_domain " + this.escaped(name, true) + " " + this.registeredDomains[name] + ")");
            }
        }
    };

    this.write = function (name, value) {
        if (typeof (value) === "string")
            value = this.escaped(value, true);
        this.send("(cset " + this.escaped(name, true) + " " + value + ")");
    };

    this.forceWrite = function (name, value) {
        if (typeof (value) === "string")
            value = this.escaped(value, true);
        this.send("(cforce " + this.escaped(name, true) + " " + value + ")");
    };

    this.setQuality = function (name, value) {
        this.send("(quality " + this.escaped(name, true) + " " + value + ")");
    };
    
    // Escape a string for transmission, optionally surrounded by double quotes
    this.escaped = function (word, quoted) {
        if (!word)
            word = "";

        word = word.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\"/g, "\\\"");

        quoted = quoted || false;
        if (quoted)
            return "\"" + word + "\"";
        else
            return word;
    };

    // Process an incoming message and trigger the appropriate handler

    this.process = function (data) {
        var tokens = new Array();
        var x;

        Lisp.tokenize(data, 0, tokens);
        tokens.forEach(function (y) {
            if (_this.handlers[y[0]]) {
                _this.handlers[y[0]](y);
            }
            else if (_this.handlers["AsyncMessage"]) {
                _this.handlers["AsyncMessage"](y);
            }
        });
    };

    this.qualities = [];
    this.qualities[0x00] = "Bad";
    this.qualities[0x40] = "Uncertain";
    this.qualities[0x04] = "Config error";
    this.qualities[0x08] = "Not connected";
    this.qualities[0x0c] = "Device failure";
    this.qualities[0x10] = "Sensor failure";
    this.qualities[0x14] = "Last known";
    this.qualities[0x18] = "Comm failure";
    this.qualities[0x1c] = "Out of service";
    this.qualities[0x20] = "Waiting for data";
    this.qualities[0x44] = "Last usable";
    this.qualities[0x50] = "Sensor calibration";
    this.qualities[0x54] = "EGU exceeded";
    this.qualities[0x58] = "Sub normal";
    this.qualities[0xc0] = "Good";
    this.qualities[0xd8] = "Local override";

    this.QualityName = function (quality) {
        var x = this.qualities[quality];
        if (!x)
            x = "Other";
        return x;
    };


    // Prepend a zero to a single-digit number
    this.LZ = function (x) {
        return (x >= 10 || x < 0 ? "" : "0") + x;
    };

    // Prepend enough zeros to make a number 3 digits long
    this.LZZ = function (x) {
        return x < 0 || x >= 100 ? "" + x : "0" + this.LZ(x);
    };

    this.ISOlocaltimeStr = function (d) {
        return this.LZ(d.getHours()) + ':' + this.LZ(d.getMinutes()) + ':' + this.LZ(d.getSeconds());
    };

    this.ISOlocaldateStr = function (d) {
        return this.LZ(d.getFullYear()) + '-' + this.LZ(d.getMonth()) + '-' + this.LZ(d.getDate());
    };

    this.ISOlocalDTstr = function (d) {
        return this.ISOlocaldateStr(d) + ' ' + this.ISOlocaltimeStr(d);
    };

    this.StampTime = function (secs) {
        var d = new Date(secs * 1000);
        return this.ISOlocaltimeStr(d) + "." + this.LZZ(Math.floor(secs * 1000) % 1000);
    };

    return this;
}
