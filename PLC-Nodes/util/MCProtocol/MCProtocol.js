/**
 * Copyright (c) 2015-2017, Yaacov Zamir <kobi.zamir@gmail.com>
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

"use strict";

// Modbus-serialモジュールを導入
const ModbusRTU = require("modbus-serial");

const SUB_HEADER1 = 0x5400;
const SUB_HEADER2 = 0x0000;
const SUB_HEADER_LEN = 6;
const MONITORING_TIMER = 16;
const ACCESS_ROUTE_LEN = 5;
const REQUEST_LEN = 10;
const READCMND = 0x0401;
const DEV_CODE = {
    "SM": {code: 0x91, subCmnd: 0x0001},
    "SD": {code: 0xA9, subCmnd: 0x0001},
    "X" : {code: 0x9C, subCmnd: 0x0001},
    "Y" : {code: 0x9D, subCmnd: 0x0001},
    "M" : {code: 0x90, subCmnd: 0x0001},
    "L" : {code: 0x92, subCmnd: 0x0001},
    "F" : {code: 0x93, subCmnd: 0x0001},
    "V" : {code: 0x94, subCmnd: 0x0001},
    "B" : {code: 0xA0, subCmnd: 0x0001},
    "D" : {code: 0xA8, subCmnd: 0x0000},
    "W" : {code: 0xB4, subCmnd: 0x0000},
    "TN": {code: 0xC2, subCmnd: 0x0000},
    "CN": {code: 0xC5, subCmnd: 0x0000}
};

/**
 * ModbusRTUクラスを拡張し、MCProtocolクラスを作成
 * Class making ModbusRTU calls fun and easy.
 *
 * @param {SerialPort} port the serial port to use.
 */
class MCProtocol extends ModbusRTU {
    constructor(port){
        super(port);
    };

    /* Modbus ParsersをMCプロトコール対応にオーバーライド
     *
     * Open the serial port and register Modbus parsers
     *
     * @param {Function} callback the function to call next on open success
     *      of failure.
     */
    open (callback) {
        var mcprtcl = this;
    
        // open the serial port
        mcprtcl._port.open(function(error) {
            if (error) {
                modbusSerialDebug({ action: "port open error", error: error });
                /* On serial port open error call next function */
                if (callback)
                    callback(error);
            } else {
                /* init ports transaction id and counter */
                mcprtcl._port._transactionIdRead = 1;
                mcprtcl._port._transactionIdWrite = 1;
    
                /* On serial port success
                 * register the mcprtcl parser functions
                 */
                mcprtcl._port.on("data", function(data) {
                    // set locale helpers variables
                    var transaction = mcprtcl._transactions[mcprtcl._port._transactionIdRead];
    
                    // the _transactionIdRead can be missing, ignore wrong transaction it's
                    if (!transaction) {
                        return;
                    }
    
                    /* cancel the timeout */
                    _cancelTimeout(transaction._timeoutHandle);
                    transaction._timeoutHandle = undefined;
    
                    /* check if the timeout fired */
                    if (transaction._timeoutFired === true) {
                        // we have already called back with an error, so don't generate a new callback
                        return;
                    }
    
                    /* check incoming data
                     */
    
                    // check access route
                    if (transaction.route !== data.slice(0, 5)){
                        return;
                    }

                    /* check for MC protocol return code
                     */
                    if (errorCode = data.readUInt16LE(7)) {
                        if (transaction.next) {
                            error = new Error("MC returns: " + errorCode);
                            error.mcprtclCode = errorCode;
                            transaction.next(error);
                        }
                        return;
                    }
                    // device code and device number
                    let address = (data.readUInt32LE(9) & 0x00111111);
                    let devCode = data.readUInt8(12);

                    // check message address and code
                    if (address !== transaction.address || devCode !== DEV_CODE[transaction.dev].devCode) {
                        error = "Unexpected data error, expected " +
                        transaction.dev + ":" +transaction.address + 
                        " got " + dev + ":" + address;
                        if (transaction.next)
                            transaction.next(new Error(error));
                        return;
                    }
                    let length = transaction.num;
                    let contents = [];
                    // Word access command response
                    if (DEV_CODE[transaction.dev].subCmnd === 0x0000) {
                        // check response length
                        if (data.readUInt32LE(6) !== transaction.num * 2) {
                            if (transaction.next) {
                                error = new Error("response deta length does't match: " + data.readUInt32LE(6) );
                                transaction.next(error);
                            }
                            return;
                        }
                        for (let i = 0; i < length; i++) {
                            contets.push(data.readUint16LE(9 + i));
                        }
                    } 
                    // Bit access command response
                    else {
                        // check response length
                        if (data.readUInt32LE(6) !== Math.clel(transaction.num / 2)) {
                            if (transaction.next) {
                                error = new Error("response deta length does't match: " + data.readUInt32LE(6) );
                                transaction.next(error);
                            }
                            return;
                        }
                        for (let i = 0; i < length; i += 2) {
                            let value = data.readUint8(9 + i)
                            contets.push(value >> 4 === 1);
                            contets.push(value & 0x0f === 1);
                        }
                    }
                    if (next)
                    next(null, { "data": contents, "buffer": data.slice(9, ) });
                });
    
                /* On serial port open OK call next function with no error */
                if (callback)
                    callback(error);
            }
        });
    };
    
    /**
     * MCプロトコールで、PLCへの要求電文を送出する外部メソッドを追加定義する
     * 
     * ModbusRTUにおいて、各ファンクションコードの電文を書き込むメソッドに相当する。
     * 実際にはPromiseでラップして同期的に利用する。
     * 
     */
    readPLCDev (accessRoute, param, next) {

        let dev;
        let address = param.address;
        let length = param.qty;
        let route =  Buffer.from(accessRoute, "hex");

        // check port is actually open before attempting write
        if (this.isOpen !== true) {
            if (next) next(new PortNotOpenError());
            return;
        }
        // sanity check
        if (typeof accessRoute === "undefined" || typeof address === "undefined") {
            if (next) next(new BadAddressError());
            return;
        }
        if (!accessRoute) {
            if (next) next(new BadAddressError());
            return;
        }

        dev = DEV_CODE[param.dev].devCode;
        subCmnd = DEV_CODE[param.dev].subCmnd;
       
        // set state variables
        this._transactions[this._port._transactionIdWrite] = {
            route: route,
            dev: param.dev,
            address: address,
            num: length,
            next: next
        };
        let request = Buffer.alloc(REQUEST_LEN);
        request.writeUInt16LE(READCMND,0);   // Command
        request.writeUInt16LE(subCmnd,2);    // sub-command
        request.writeUInt32LE(address,4);    // Dev. number
        request.writeUInt8(dev,7);           // Dev. code
        request.writeUInt16LE(length,8);     // Number of data

        // Write data to communication port & set transaction params
        var transaction = this._transactions[transactionIdWrite];
        this._port.mcWrite(route, reques);
        if (transaction) {
            transaction._timeoutFired = false;
            transaction._timeoutHandle = _startTimeout(this._timeout, transaction);
        }
    };

};

/**
 * Simulate a modbus-RTU port using modbus-TCP connection.
 *
 * @param ip
 * @param options
 *   options.port: Nonstandard Modbus port (default is 502).
 *   options.localAddress: Local IP address to bind to, default is any.
 *   options.family: 4 = IPv4-only, 6 = IPv6-only, 0 = either (default).
 * @constructor
 */
class MCTcpPort extends ModbusRTU.TcpPort {
    constructor(ip, options){
        super(ip, options);

        // Modbus TcpPortのデータ受信コールバックをMCプロトコール対応に付け替え
        this._client.on("data", function(data) {
            var buffer;
            var crc;
            var length;
    
            // data recived
            modbusSerialDebug({ action: "receive tcp port strings", data: data });
    
            // check data length
            while (data.length > 0) {

                // response data length
                length = data.readUInt16BE(11);
    
                // cut sub-header
                buffer = Buffer.alloc(ACCESS_ROUTE_LEN + length + 1);
                data.copy(buffer, 0, 6);
    
                // update transaction id and emit data
                mcprtcl._transactionIdRead = data.readUInt16LE(2);
                mcprtcl.emit("data", buffer);
    
                // debug
                modbusSerialDebug({ action: "parsed tcp port", buffer: buffer, transactionId: mcprtcl._transactionIdRead });
    
                // reset data
                data = data.slice(SUB_HEADER_LEN + buffer.length);
            }
        });
    };
    // Modbus TcpPortのMCプロトコール対応methodを登録
    // TCP電文フォーマットに合わせて、ヘッダ等を付加
    mcWrite (route, request) {
        // Check access route and request string length
        if (route.length !== 10 || request.length !== 20) {
            modbusSerialDebug("Access route is invalid");
            return;
        } 

        // prepare TCP/IP 4EFrame buffer
        let bufLength = route.length + request.length;   //access route & request data length
        bufLength += 4;        // add the monitoring timer length.
        bufLength += 6;        // add sub header length
        var buffer = Buffer.alloc(bufLength);

        buffer.writeUInt16BE(SUB_HEADER1, 0);                    // Fixed sub-header
        buffer.writeUInt16LE(this._transactionIdWrite, 2);  // seq. Number
        buffer.writeUInt16BE(SUB_HEADER2, 4);                         // Fixed sub-header

        route.copy(buffer, 6,);         // Access route for 4E frame

        buffer.writeUInt16LE(request.length + 2,11);    // Request length
        buffer.writeUInt16LE(MONITORING_TIMER,13);    // Monitoring timer

        request.copy(buffer, 15);       // Request data for device read

        modbusSerialDebug({
            action: "send tcp port",
            request: request,
            accessRoute: route,
            buffer: buffer,
            transactionsId: this._transactionIdWrite
        });
    
        // send buffer to slave
        this._client.write(buffer);
    
        // set next transaction id
        this._transactionIdWrite = (this._transactionIdWrite + 1) % MAX_TRANSACTIONS;
    };

    
   
}

 /**
 * Open the serial port and register MCProtocol parsers
 * Over Ride original ModbusRTU.prototype.open()
 *
 * @param {Function} callback the function to call next on open success
 *      of failure.
 */

class MCSerialF4 extends ModbusRTU.asciiport {
    constructor(path, options){
        super(path, options);
    }

}

class MCSerialF5 extends ModbusRTU.RTUBufferedPort {
    constructor(path, options){
        super(path, options);
    }

}

// exports
module.exports.MCProtocol = MCProtocol;
module.exports.MCTcpPort = MCTcpPort;
module.exports.MCSerialF4 = MCSerialF4;
module.exports.MCSerialF5 = MCSerialF5;