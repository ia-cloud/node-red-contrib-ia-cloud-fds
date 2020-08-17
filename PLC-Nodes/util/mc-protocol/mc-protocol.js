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
const InterByteTimeout = require('@serialport/parser-inter-byte-timeout');
const Delimiter = require('@serialport/parser-delimiter');

const SUB_HEADER1 = 0x5400;
const SUB_HEADER2 = 0x0000;
const SUB_HEADER_LEN = 6;
const MONITORING_TIMER = 16;
const ACCESS_ROUTE_LEN_4E = 5;
const ACCESS_ROUTE_LEN_4C = 7;
const ACCESS_ROUTE_LEN_3C = 4;
const HEADER_F5 = 0x1002;
const FOOTER_F5 = 0x1003;
const HEADER_F4 = 0x05;
const FOOTER_F4 = "\x0D\x0A";

const REQUEST_LEN = 10;
const ID_FRAME_3C = "F9";
const ID_FRAME_4C = 0xf8;
const READCMND = 0x0401;
const DEV_CODE = {
    "SM": {code: 0x91, subCmnd: 0x0001, hex: false},
    "SD": {code: 0xA9, subCmnd: 0x0001, hex: false},
    "X" : {code: 0x9C, subCmnd: 0x0001, hex: true},
    "Y" : {code: 0x9D, subCmnd: 0x0001, hex: true},
    "M" : {code: 0x90, subCmnd: 0x0001, hex: false},
    "L" : {code: 0x92, subCmnd: 0x0001, hex: false},
    "F" : {code: 0x93, subCmnd: 0x0001, hex: false},
    "V" : {code: 0x94, subCmnd: 0x0001, hex: false},
    "B" : {code: 0xA0, subCmnd: 0x0001, hex: true},
    "D" : {code: 0xA8, subCmnd: 0x0000, hex: false},
    "W" : {code: 0xB4, subCmnd: 0x0000, hex: true},
    "TN": {code: 0xC2, subCmnd: 0x0000, hex: false},
    "CN": {code: 0xC5, subCmnd: 0x0000, hex: false}
};
const MAX_TRANSACTIONS = 128;
const MAX_SERIAL_BUFFER_LEN = 1024;

const TRANSACTION_TIMED_OUT_MESSAGE = "Timed out";
const TRANSACTION_TIMED_OUT_ERRNO = "ETIMEDOUT";
const BAD_ACCESSROUTE_MESSAGE = "Bad access route";
const BAD_ACCESSROUTE_ERRNO = "Bad access route";


var MCPortNotOpenError = function() {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = PORT_NOT_OPEN_MESSAGE;
    this.errno = PORT_NOT_OPEN_ERRNO;
};

var MCBadAccessRouteError = function() {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = BAD_ACCESSROUTE_MESSAGE;
    this.errno = BAD_ACCESSROUTE_ERRNO;
};

var MCTransactionTimedOutError = function() {
    this.name = this.constructor.name;
    this.message = TRANSACTION_TIMED_OUT_MESSAGE;
    this.errno = TRANSACTION_TIMED_OUT_ERRNO;
};

/**
 * ModbusRTUクラスを拡張し、MCProtocolクラスを作成
 * Class making ModbusRTU calls fun and easy.
 *
 * @param {SerialPort} port the serial port to use.
 */

class MCProtocol extends ModbusRTU.default {
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
                // this event listener recieves a buffer that contains
                // [error code(1byte) + response length(2Bytes) + response code(2bytes) + response data(nBytes)]
                // in binary format
                mcprtcl._port.removeAllListeners("data");
                mcprtcl._port.on("data", function(data) {


                    let error = "";
                    // set locale helpers variables
                    var transaction = mcprtcl._transactions[mcprtcl._port._transactionIdRead];

                    // the _transactionIdRead can be missing, ignore wrong transaction it's
                    if (!transaction) {
                        return;
                    }

                    /* cancel the timeout */
                    clearTimeout(transaction._timeoutHandle);
                    transaction._timeoutHandle = undefined;
    
                    /* check if the timeout fired */
                    if (transaction._timeoutFired === true) {
                        // we have already called back with an error, so don't generate a new callback
                        return;
                    }
    
                    // check incoming data
    
                    // check data link & route error
                    let errStatus = data.readUInt8(0);
                    if (errStatus !== 0x0){
                        if (transaction.next) {
                            if (errStatus & 0x08) error = new Error("MC access route not accepted");
                            if (errStatus & 0xf0) error = new Error("MC serial data link layer error");
                            transaction.next(error);
                        }
                        return;
                    }

                    // check for MC protocol return code
                    let errorCode = data.readUInt16LE(3)
                    if (errorCode) {
                        if (transaction.next) {
                            error = new Error("MC returns: " + errorCode);
                            error.mcprtclCode = errorCode;
                            transaction.next(error);
                        }
                        return;
                    }
                    let length = transaction.num;
                    let contents = [];
                    // Word access command response
                    if (DEV_CODE[transaction.dev].subCmnd === 0x0000) {
                        // check response length
                        if (data.readUInt16LE(1) - 2 !== transaction.num * 2) {
                            if (transaction.next) {
                                error = new Error("response deta length does't match: " + data.readUInt16LE(1) );
                                transaction.next(error);
                            }
                            return;
                        }
                        for (let i = 0; i < length; i++) {
                            contents.push(data.readUInt16LE(5 + i * 2));
                        }
                    } 
                    // Bit access command response
                    else {
                        // check response length
                        if (data.readUInt16LE(1) - 2 !==  Math.ceil(length / 2)) {
                            if (transaction.next) {
                                error = new Error("response deta length does't match: " + data.readUInt16LE(1) );
                                transaction.next(error);
                            }
                            return;
                        }
                        let value;
                        for (let i = 0; i < length; i += 2) {
                            value = data.readUInt8(5 + i / 2)
                            contents.push(value >> 4 === 1);
                            if (i + 1 === length) break;
                            contents.push((value & 0x0f) === 1);
                        }
                    }
                    if (transaction.next)
                        transaction.next(null, { "data": contents, "buffer": data.slice(5, ) });
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
    writeDevRead (accessRoute, param, next) {

        let dev;
        let subCmnd;
        let address = param.addr;
        let length = param.qty;
        let route =  Buffer.from(accessRoute, "hex");

        // convert unit No. to little endian
        // route.writeUInt16LE(route.readUInt16BE(2),2);
        // この処理は、Portクラスで実行するように修正

        // check port is actually open before attempting write
        if (this.isOpen !== true) {
            if (next) next(new PortNotOpenError());
            return;
        }
        // sanity check
        if (typeof accessRoute === "undefined" || typeof address === "undefined") {
            if (next) next(new BadAccessRouteError());
            return;
        }
        if (!accessRoute) {
            if (next) next(new BadAccessRouteError());
            return;
        }

        dev = DEV_CODE[param.dev].code;
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
        var transaction = this._transactions[this._port._transactionIdWrite];
        this._port.mcWrite(route, request);

        // set timeout timer
        if (transaction) {
            transaction._timeoutFired = false;
            if(!this._timeout) transaction._timeoutHandle = undefined;
            else transaction._timeoutHandle = setTimeout (
                function(){
                    transaction._timeoutFired = true;
                    if (transaction.next) {
                        transaction.next(new TransactionTimedOutError());
                    }
                }, this._timeout
            );
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
        let mcTcp = this;
        mcTcp._route = 0x0;

        // Modbus TcpPortのデータ受信コールバックをMCプロトコール対応に付け替え
        this._client.removeAllListeners("data");
        this._client.on("data", function(data) {
            var buffer;
            var crc;
            var length;
  
            // data recived    
            /* Modbus-serial moduleの実装を踏襲：一つのeventに複数のPDUが含まれている
            可能性に対応したコードになっている。
            */
            while (data.length > SUB_HEADER_LEN + ACCESS_ROUTE_LEN_4E) {

                // response data length
                length = data.readUInt16LE(11);
                // prepare buffer to emit 
                buffer = Buffer.alloc(length + 3);

                // access route check
                if (data.slice(6, 11).equals(mcTcp._route)) buffer.writeUInt8(0x0, 0)
                else buffer.writeUInt8(0x08, 0)

                // cut sub-header
                data.copy(buffer, 1, SUB_HEADER_LEN + ACCESS_ROUTE_LEN_4E);
    
                // update transaction id and emit data
                mcTcp._transactionIdRead = data.readUInt16LE(2);
                mcTcp.emit("data", buffer);
    
                // reset data
                data = data.slice(SUB_HEADER_LEN + buffer.length);
            }
        });
    };
    // Modbus TcpPortのMCプロトコール対応methodを登録
    // TCP電文フォーマットに合わせて、ヘッダ等を付加
    mcWrite (route, request) {
        // Check access route and request string length
        if (route.length !== 5 || request.length !== REQUEST_LEN) {
            // Access route is invalid
            return;
        } 
        // convert unit No. to little endian
        route.writeUInt16LE(route.readUInt16BE(2),2);

        this._route = route;

        // prepare TCP/IP 4EFrame buffer
        let bufLength = route.length + request.length;   //access route & request data length
        bufLength += 4;        // add the monitoring timer length.
        bufLength += 6;        // add sub header length
        var buffer = Buffer.alloc(bufLength);

        buffer.writeUInt16BE(SUB_HEADER1, 0);               // Fixed sub-header
        buffer.writeUInt16LE(this._transactionIdWrite, 2);  // seq. Number
        buffer.writeUInt16BE(SUB_HEADER2, 4);               // Fixed sub-header

        route.copy(buffer, 6,);         // Access route for 4E frame

        buffer.writeUInt16LE(request.length + 2,11);    // Request length
        buffer.writeUInt16LE(MONITORING_TIMER,13);      // Monitoring timer

        request.copy(buffer, 15);       // Request data for device read
   
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

class MCSerialF4 extends ModbusRTU.RTUBufferedPort {
    constructor(path, options){
        super(path, options);

        let mcF４ = this;
        // overide class member buuffer
        this._buffer = Buffer.alloc(MAX_SERIAL_BUFFER_LEN);
        // adds class meber info
        this._bufInfo = {
            bp: 0,
            cCode: 0x00,
            sumcheck: 0,
        };
        this._route = ""; 
        this.subcommand = "0000";
        this._parser = this._client.pipe(new Delimiter({delimiter: FOOTER_F4}));
        
        // Modbus TcpPortのデータ受信コールバックをMCプロトコール対応に付け替え
        this._parser.removeAllListeners("data");
        this._parser.on("data", function(data) {

            let buffer = mcF４._buffer;
            let bufInfo = mcF４._bufInfo;
            let value;         

            for ( let i = 0; i < data.length; i++) {

                value = data.readUInt8(i);
                if (bufInfo.cCode === 0x02){
                    if (value === 0x02) {       // restart bufferring
                        bufInfo.bp = 0;         // reset bufferring pointer
                    } else if (value === 0x03) {    // ETX recieved
                        bufInfo.cCode = value;
                        buffer.writeUInt8(value, bufInfo.bp++);
                        bufInfo.sumcheck += value;
                    } else {                    // sttore byte to the buffer
                        buffer.writeUInt8(value, bufInfo.bp++);
                        bufInfo.sumcheck += value;
                    }
                } else if (bufInfo.cCode === 0x03) {
                    if (value === 0x02) {       // restart bufferring
                        bufInfo.bp = 0;         // reset bufferring pointer
                    } else if (value !== 0x03) {    // store sumceck bytes
                        buffer.writeUInt8(value, bufInfo.bp++);
                        buffer.writeUInt8(data.readUInt8(i + 1), bufInfo.bp++);
                        break;
                    }
                } else {
                    if (value === 0x02) {       // start bufferring
                        bufInfo.bp = 0;         // reset bufferring pointer
                        bufInfo.cCode = value;
                    }
                }
            }

            // full of response recieved
            let error = 0x0;
            // frame ID check
            if (buffer.toString("ascii", 0, 2) !== ID_FRAME_3C)
                error |= 0x40;
            // sumcheck
            if (bufInfo.sumcheck.toString(16).slice(-2).toUpperCase()
                !== buffer.toString("ascii",bufInfo.bp - 2, bufInfo.bp))
                    error |= 0x10;
            // access route check
            if (!buffer.slice(2, 10).equals(mcF４._route)) error |= 0x08;

            let rcvDataLength, rcvData;

            if (mcF４._subCommand === "0000") {
            // in the case of word device read
                // cut unnecessary bytes(route, sumcheck, frame ID and ETX)
                rcvDataLength = (bufInfo.bp - (ACCESS_ROUTE_LEN_3C * 2) - 2 - 2 - 1) / 2;           
                // add a bytes for error code(1), response code(2) & length of bytes(2)
                rcvData = Buffer.alloc(rcvDataLength + 5);
                let i = 10, j = 0;
                while (j < rcvDataLength) {
                    rcvData.writeUInt16LE(parseInt(buffer.toString("ascii", i, i + 4,), 16) , j + 5);
                    i += 4;
                    j += 2;
                }
            } else {
            // in the case of bit device read
                // cut unnecessary bytes(route, sumcheck and frame ID and ETX)
                rcvDataLength = Math.ceil((bufInfo.bp - (ACCESS_ROUTE_LEN_3C * 2) - 2 - 2 - 1) / 2);                 
                // add a bytes for error code(1), response code(2) & length of bytes(2)
                rcvData = Buffer.alloc(rcvDataLength + 5);
                let i = 10, j = 0, v;
                while ( j < rcvDataLength) {
                    v = ((buffer.readUInt8(i++) & 0x0f) << 4);
                    if (!buffer.readUInt8(i) === 0x03) v += (buffer.readUInt8(i++) & 0x0f);
                    rcvData.writeUInt8(v, j++ + 5);
                }
            }

            // set error code
            rcvData.writeUInt8(error, 0);
            // set response code to 0
            rcvData.writeUInt16LE(0, 3);
            // set the number of bytes(adds 2byte of response code length)
            rcvData.writeUInt16LE(rcvDataLength + 2, 1);
            // deta eimit
            mcF４.emit("data",rcvData);
            // cleare bufInfo for the next 
            bufInfo.bp = 0;
            bufInfo.cCode = 0x00;
            bufInfo.sumcheck = 0;           
        });
    }
    // Modbus TcpPortのMCプロトコール対応methodを登録
    // シリアル形式4フォーマットに合わせてASCII形式に変換し、ヘッダ等を付加
    mcWrite (route, request) {
        // Check access route and request string length
        if (route.length !== ACCESS_ROUTE_LEN_3C || request.length !== REQUEST_LEN) {
            // Access route is invalid
            return;
        } 
        // convert access route to ascii expression
        route = Buffer.from(route.toString("hex").toUpperCase(), "ascii");
        this._route = route;

        let requestString = "";
        // swap command code
        requestString += request.readUInt16LE(0).toString(16).toUpperCase().padStart(4, "0");
        // swap sub command code
        this._subCommand = (request.readUInt16LE(2).toString(16).toUpperCase().padStart(4, "0"));
        requestString += this._subCommand;
         
        let devCode = request.readUInt8(7);
        devCode = Object.keys(DEV_CODE).find(key => DEV_CODE[key].code === devCode);
        // set device code
        requestString += (devCode.padEnd(2, "*"));

        if (DEV_CODE[devCode].hex)
            // swap and set device address number in hex
            requestString += ((request.readUInt32LE(4) & 0x0fff).toString(16).toUpperCase().padStart(6, "0"));
        else
            // swap and set device address number in decimal
            requestString += ((request.readUInt32LE(4) & 0x0fff).toString(10).toUpperCase().padStart(6, "0"));

        // swap number of device to read
        requestString += (request.readUInt16LE(8).toString(16).toUpperCase().padStart(4, "0"));

        request = Buffer.from(requestString, "ascii");

        // prepare serial format4 buffer
        let bufLength = route.length + request.length;   //access route & request data length
        bufLength += 2 ;      // add frame ID No. length
        bufLength += 3 ;      // add control code(ENQ, CR, LF)) length
        bufLength += 2 ;      // add sumcheck length

        // alloc data buffer
        let buffer = Buffer.alloc(bufLength);

        // header ENQ(0x05)
        buffer.writeUInt8(HEADER_F4, 0);

        // set the number of data bytes
        buffer.write(ID_FRAME_3C, 1);      // 3C frame ID

        route.copy(buffer, 3);          // Access route for 4C frame
        request.copy(buffer, 11);       // Request data for device read

        // sumcheck generation 
        // from after of ENQ code to before sumcheck code
        let sumcheck = 0;
        for (let i = 1; i < bufLength - 4; i++) {
            sumcheck = sumcheck + buffer.readUInt8(i);
        }
        buffer.write(sumcheck.toString(16).slice(-2).toUpperCase(),31);


        buffer.write(FOOTER_F4, 33);     // CR/LF footer
        
        // send buffer to slave
        this._client.write(buffer);    
    };

}

class MCSerialF5 extends ModbusRTU.RTUBufferedPort {
    constructor(path, options){
        super(path, options);

        let mcF5 = this;
        // overide class member buuffer
        this._buffer = Buffer.alloc(MAX_SERIAL_BUFFER_LEN);
        // adds class meber info
        this._bufInfo = {
            bp: 0,
            preValue: 0x00,
            cCode: 0x00,
            sumcheck: 0,
            length: 0
        };
        this._route = Buffer.alloc(0);

        // pipe to a time interval parser
        this._parser = this._client.pipe(new InterByteTimeout({interval: 30}))

        // Modbus TcpPortのデータ受信コールバックをMCプロトコール対応に付け替え
        this._parser.removeAllListeners("data");
        this._parser.on("data", function(data) {

            let buffer = mcF5._buffer;
            let bufInfo = mcF5._bufInfo;
            let value;

            for ( let i = 0; i < data.length; i++) {
                // get a byte form event data
                value = data.readUInt8(i);

                // data link escape(DLE) ?
                if (bufInfo.preValue !== 0x10) {     // No
                    // now on buffering, store byte to the buffer
                    if (bufInfo.cCode === 0x02 && value !== 0x10) {
                        buffer.writeUInt8(value, bufInfo.bp++);
                        bufInfo.sumcheck += value;
                    }
                    // buffering ended
                    else if (bufInfo.cCode === 0x03) {
                        buffer.writeUInt8(value, bufInfo.bp++);
                        bufInfo.length++;
                        if (bufInfo.length >= 2) break;
                    }
                // DLE yes 
                } else {
                    if (bufInfo.cCode === 0x02){        // now in buffering
                        if (value === 0x10) {
                            buffer.writeUInt8(value, bufInfo.bp++);
                            bufInfo.sumcheck += value;
                        }
                        // end of buffering
                        else if (value === 0x03) {
                            bufInfo.cCode = value;
                        }
                        // restarting buffering
                        else if (value === 0x02) {
                            bufInfo.cCode = value;
                            bufInfo.bp = 0;         // reset bufferring pointer
                            bufInfo.length = 0;
                        }
                    // start buffering
                    } else if (value === 0x02) {
                        bufInfo.cCode = value;
                        bufInfo.bp = 0;         // reset bufferring pointer
                        bufInfo.length = 0;
                    }
                }
                // set preValue for the next byte
                if (bufInfo.preValue === 0x10 && value === 0x10) bufInfo.preValue = 0x0;
                else bufInfo.preValue = value;
            }

            // full of response recieved
            if (bufInfo.length === 2) {

                let error = 0x0;
                // data length check. (except number of data bytes & sumcheck bytes)
                if (buffer.readUInt16LE(0) !== bufInfo.bp - 4) error |= 0x80;
                // frame ID check
                if (buffer.readUInt8(2) !== 0xf8) error |= 0x40;
                // response ID code check
                if (buffer.readUInt16BE(10) !== 0xffff) error |= 0x20;
                // sumcheck
                if (bufInfo.sumcheck.toString(16).slice(-2).toUpperCase()
                    !== buffer.toString("ascii",bufInfo.bp - 2, bufInfo.bp))
                        error |= 0x10;
                // access route check
                if (!buffer.slice(3, 10).equals(mcF5._route)) error |= 0x08;

                // cut unnecessary bytes
                let rcvDataLength = bufInfo.bp - ACCESS_ROUTE_LEN_4C    // route
                                               - 2 - 1      // sumcheck & response ID code
                                               - 2 - 2;     // number of bytes & response code
                // add a bytes for the number of bytes & the error code
                let rcvData = Buffer.alloc(rcvDataLength + 3);
                buffer.copy(rcvData, 3, 12, 12 + rcvDataLength);
                // set error code
                rcvData.writeUInt8(error, 0);
                // set the number of bytes
                rcvData.writeUInt16LE(rcvDataLength, 1);
                // deta eimit
                mcF5.emit("data",rcvData);
                // cleare bufInfo for the next 
                bufInfo.bp = 0;
                bufInfo.preValue = 0x00;
                bufInfo.cCode = 0x00;
                bufInfo.sumcheck = 0;
                bufInfo.length = 0;               
            }
        });
    }
    // Modbus TcpPortのMCプロトコール対応methodを登録
    // シリアル形式５フォーマットに合わせて、ヘッダ等を付加
    mcWrite (route, request) {
        // Check access route and request string length
        if (route.length !== ACCESS_ROUTE_LEN_4C || request.length !== REQUEST_LEN) {
            // Access route is invalid
            return;
        } 
        // convert unit No. to little endian
        route.writeUInt16LE(route.readUInt16BE(3),3);

        this._route = route;

        // prepare serial format5 buffer
        let bufLength = route.length + request.length;   //access route & request data length
        bufLength ++ ;      // add frame ID No. length
        bufLength += 2;     // add the number of data bytes length
        // alloc data buffer
        let buffer = Buffer.alloc(bufLength);

        // set the number of data bytes
        buffer.writeUInt16LE(bufLength - 2, 0); // number of data byte
        buffer.writeUInt8(ID_FRAME_4C, 2);      // 4C frame ID

        route.copy(buffer, 3);          // Access route for 4C frame
        request.copy(buffer, 10);       // Request data for device read

        // make data link escape(DLE) & sumcheck generation 
        let i, v;
        let msgLength = 2;
        let sumcheck = 0;;
        let sndData = Buffer.alloc(bufLength * 2);  // DLE処理で最大２倍になる可能性
        for (i = 0, msgLength = 2; i < bufLength; i++, msgLength++) {
            v = buffer.readUInt8(i);
            sndData.writeUInt8(v, msgLength);
            sumcheck = sumcheck + v;
            if (v === 0x10) sndData.writeUInt8(v, msgLength);
        }
        let sumBuf = Buffer.from(sumcheck.toString(16).slice(-2).toUpperCase());

        sndData.writeUInt16BE(HEADER_F5, 0);            // DLE,STX header
        sndData.writeUInt16BE(FOOTER_F5, msgLength);     // DLE,ETX footer
        
        msgLength += 2;
        sumBuf.copy(sndData, msgLength);      // adds sumcheck
        msgLength += 2;
        sndData = sndData.slice(0, msgLength);          // cut out to valid buffer length
        // send buffer to slave
        this._client.write(sndData);    
    };

}

// add the connection shorthand API
require("./mc-connection")(MCProtocol);
// add the promise API
require("./mc-promise")(MCProtocol);

// exports
module.exports = MCProtocol;
module.exports.MCTcpPort = MCTcpPort;
module.exports.MCSerialF4 = MCSerialF4;
module.exports.MCSerialF5 = MCSerialF5;