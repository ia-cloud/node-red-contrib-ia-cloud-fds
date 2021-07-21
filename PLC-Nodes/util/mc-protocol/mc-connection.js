"use strict";
/**
 * Copyright (c) 2015, Yaacov Zamir <kobi.zamir@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF  THIS SOFTWARE.
 */

var MIN_MODBUSRTU_FRAMESZ = 5;

/**
 * Adds connection shorthand API to a MCProtocol object
 *
 * @param {MCProtocolRTU} MCProtocol the MCProtocolRTU object.
 */
var addConnctionAPI = function(MCProtocol) {
    var cl = MCProtocol.prototype;

    var open = function(obj, next) {
        /* the function check for a callback
         * if we have a callback, use it
         * o/w build a promise.
         */
        if (next) {
            // if we have a callback, use the callback
            obj.open(next);
        } else {
            // o/w use  a promise
            var promise = new Promise(function(resolve, reject) {
                function cb(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }

                obj.open(cb);
            });

            return promise;
        }
    };

    /**
     * Connect to a communication port, using TcpPort.
     *
     * @param {string} ip the ip of the TCP Port - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */
    cl.connectTCP4E = function(ip, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // create the TcpPort
        var MCTcpPort = require("./mc-protocol").MCTcpPort4E;
        if (this._timeout) {
            options.timeout = this._timeout;
        }
        this._port = new MCTcpPort(ip, options);

        // open and call next
        return open(this, next);
    };

     /**
     * Connect to a communication port, using TcpPort.
     *
     * @param {string} ip the ip of the TCP Port - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */
      cl.connectTCP3E = function(ip, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // create the TcpPort
        var MCTcpPort = require("./mc-protocol").MCTcpPort3E;
        if (this._timeout) {
            options.timeout = this._timeout;
        }
        this._port = new MCTcpPort(ip, options);

        // open and call next
        return open(this, next);
    };

    /**
     * Connect to a communication port, using Bufferd Serial port.
     *
     * @param {string} path the path to the Serial Port - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */

    cl.connectSerialF5 = function(path, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // create the SerialF5Port
        var F5Port = require("./mc-protocol").MCSerialF5;
        this._port = new F5Port(path, options);

        // open and call next
        return open(this, next);
    };

    /**
     * Connect to a communication port, using ASCII Serial port.
     *
     * @param {string} path the path to the Serial Port - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */
    
    cl.connectSerialF4 = function(path, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // create the SerialF4Port
        var F4Port = require("./mc-protocol").MCSerialF4;
        this._port = new F4Port(path, options);

        // open and call next
        return open(this, next);
    };

};

/**
 * Connection API MCProtocol.
 *
 * @type {addConnctionAPI}
 */
module.exports = addConnctionAPI;
