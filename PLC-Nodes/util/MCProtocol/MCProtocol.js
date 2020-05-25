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
    
                    /* check minimal length
                     */
                    if (!transaction.lengthUnknown && data.length < 5) {
                        error = "Data length error, expected " +
                            transaction.nextLength + " got " + data.length;
                        if (transaction.next)
                            transaction.next(new Error(error));
                        return;
                    }
    
                    // if crc is OK, read address and function code
                    var address = data.readUInt8(0);
                    var code = data.readUInt8(1);
    
                    /* check for mcprtcl exception
                     */
                    if (data.length >= 5 &&
                        code === (0x80 | transaction.nextCode)) {
                        var errorCode = data.readUInt8(2);
                        if (transaction.next) {
                            error = new Error("mcprtcl exception " + errorCode + ": " + (mcprtclErrorMessages[errorCode] || "Unknown error"));
                            error.mcprtclCode = errorCode;
                            transaction.next(error);
                        }
                        return;
                    }
    
                    /* check message length
                     * if we do not expect this data
                     * raise an error
                     */
                    if (!transaction.lengthUnknown && data.length !== transaction.nextLength) {
                        error = "Data length error, expected " +
                            transaction.nextLength + " got " + data.length;
                        if (transaction.next)
                            transaction.next(new Error(error));
                        return;
                    }
    
                    /* check message address and code
                     * if we do not expect this message
                     * raise an error
                     */
                    if (address !== transaction.nextAddress || code !== transaction.nextCode) {
                        error = "Unexpected data error, expected " +
                            transaction.nextAddress + " got " + address;
                        if (transaction.next)
                            transaction.next(new Error(error));
                        return;
                    }
    
                    /* parse incoming data
                     */
                    // Read Input Status (FC=02)
                    _parseResp(data, transaction.next);
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
    readPLCDev (accessRoute, dataAddress, length, next) {
        // check port is actually open before attempting write
        if (this.isOpen !== true) {
            if (next) next(new PortNotOpenError());
            return;
        }
    
        // sanity check
        if (typeof accessRoute === "undefined" || typeof dataAddress === "undefined") {
            if (next) next(new BadAddressError());
            return;
        }

        // set state variables
        this._transactions[this._port._transactionIdWrite] = {
            nextAddress: address,
            nextLength: 3 + parseInt((length - 1) / 8 + 1) + 2,
            next: next
        };
    
        var codeLength = 6;
        var buf = Buffer.alloc(codeLength + 2); // add 2 crc bytes
    
        buf.writeUInt8(address, 0);
        buf.writeUInt8(code, 1);
        buf.writeUInt16BE(dataAddress, 2);
        buf.writeUInt16BE(length, 4);
    
        // add crc bytes to buffer
        buf.writeUInt16LE(crc16(buf.slice(0, -2)), codeLength);
    
        // write buffer to serial port
        _writeBufferToPort.call(this, buf, this._port._transactionIdWrite);
    };

    /**
     * Parse the data for a MCProtocol -
     *
     * @param {Buffer} data the data buffer to parse.
     * @param {Function} next the function to call next.
     */
    _parseResp(data, next) {
        var length = data.readUInt8(2);
        var contents = [];

        for (var i = 0; i < length; i++) {
            var reg = data[i + 3];

            for (var j = 0; j < 8; j++) {
                contents.push((reg & 1) === 1);
                reg = reg >> 1;
            }
        }

        if (next)
            next(null, { "data": contents, "buffer": data.slice(3, 3 + length) });
    }
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
            while (data.length > MIN_MBAP_LENGTH) {
                // parse tcp header length
                length = data.readUInt16BE(4);
    
                // cut 6 bytes of mbap and copy pdu
                buffer = Buffer.alloc(length + CRC_LENGTH);
                data.copy(buffer, 0, MIN_MBAP_LENGTH);
    
                // add crc to message
                crc = crc16(buffer.slice(0, -CRC_LENGTH));
                buffer.writeUInt16LE(crc, buffer.length - CRC_LENGTH);
    
                // update transaction id and emit data
                mcprtcl._transactionIdRead = data.readUInt16BE(0);
                mcprtcl.emit("data", buffer);
    
                // debug
                modbusSerialDebug({ action: "parsed tcp port", buffer: buffer, transactionId: mcprtcl._transactionIdRead });
    
                // reset data
                data = data.slice(length + MIN_MBAP_LENGTH);
            }
        });
    };
    // Modbus TcpPortの書き込みメソッドをMCプロトコール対応にオーバーライド
    // TCP電文フォーマットに合わせて、サブヘッダ等を付加
    write (data) {
        if(data.length < MIN_DATA_LENGTH) {
            modbusSerialDebug("expected length of data is to small - minimum is " + MIN_DATA_LENGTH);
            return;
        }
    
        // remember current unit and command
        this._id = data[0];
        this._cmd = data[1];
    
        // remove crc and add mbap
        var buffer = Buffer.alloc(data.length + MIN_MBAP_LENGTH - CRC_LENGTH);
        buffer.writeUInt16BE(this._transactionIdWrite, 0);
        buffer.writeUInt16BE(0, 2);
        buffer.writeUInt16BE(data.length - CRC_LENGTH, 4);
        data.copy(buffer, MIN_MBAP_LENGTH);
    
        modbusSerialDebug({
            action: "send tcp port",
            data: data,
            buffer: buffer,
            unitid: this._id,
            functionCode: this._cmd,
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