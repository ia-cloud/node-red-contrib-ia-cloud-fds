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

const util = require('util');
const SerialPort = require('serialport');
const stream = require("stream");
const BAUDRATE = 57600;         /* set baudrate 57600bps (enocean default)
                                parity none, stopbit 1, databit 8 are serialport defaults */
const INTERBYTETIMEOUT = 60;   // set inter byte timeout 100ms

module.exports = function (RED) {
    'use strict';

    const crc8 = require('crc-full').CRC.default('CRC8');

    /**
     * Pick up 'Sync. Byte', 'Header' and 'CRC8H' from receivedEspData.
     * @param {Buffer} receivedEspData
     * @returns {Array<object>} Array of ESP3 Packet object.
     */
    const pickupEspPacketAsObject = (receivedEspData) => {
        const espArray = [];
        let restBuffer = receivedEspData;
        // loop in case EspData are combined
        do {
            // find syncByte index
            const syncByteIndex = restBuffer.findIndex((d) => d === 0x55);
            // slide restBuffer to the beginning of syncByte
            restBuffer = restBuffer.slice(syncByteIndex);

            const syncByte = restBuffer.slice(0, 1).toString('hex'); // restBuffer[0].toString(16),
            const dataLength = restBuffer.slice(1, 3).toString('hex');
            const optionalLength = restBuffer.slice(3, 4).toString('hex');
            const packetType = restBuffer.slice(4, 5).toString('hex');
            const crc8h = restBuffer.slice(5, 6).toString('hex');
            //
            const dataLengthAsInt = parseInt(dataLength, 16);
            const optionalLengthAsInt = parseInt(optionalLength, 16);
            const offsetOptionalData = 6 + dataLengthAsInt;
            const offsetCrc8d = offsetOptionalData + optionalLengthAsInt;
            //
            const data = restBuffer.slice(6, offsetOptionalData).toString('hex');
            const optionalData = restBuffer.slice(offsetOptionalData, offsetCrc8d).toString('hex');
            const crc8d = restBuffer.slice(offsetCrc8d, offsetCrc8d + 1).toString('hex');

            espArray.push({
                syncByte,
                header: {
                    dataLength,
                    dataLengthAsInt,
                    optionalLength,
                    optionalLengthAsInt,
                    packetType,
                },
                crc8h,
                data,
                optionalData,
                crc8d,
            });
            // if next offset cannot aquired
            if (Number.isNaN(offsetCrc8d)) break;

            // set rest of receivedEspData buffer
            restBuffer = restBuffer.slice(offsetCrc8d + 1);
        } while (restBuffer.length > 0);

        return espArray;
    };

    /**
     * Pick up individual data from ESP2 data.
     * @param {string} esp3RawData
     * @param {string} optionalData
     * @returns {object} ERP2 data
     * @see {@link EnOceanRadioProtocol2.pdf} 4.5 Data contents for Length > 6 Bytes
     */
    const pickupErp2DataAsObject = (esp3RawData, optionalData) => {
        let index = 0;

        // ----------------------------------------
        // Header

        const erp2Header = parseInt(esp3RawData.substr(index, 2), 16);
        index += 2;

        const [addressControl, extendedHeaderAvailable, telegramType] = [
            (erp2Header & 0b11100000) >> 5, // Bit 5...7 Address Control
            (erp2Header & 0b00010000) >> 4, // Bit 4 Extended header available
            (erp2Header & 0b00001111) >> 0, // Bit 0...3 Telegram type (R-ORG)
        ];

        // Bit 5...7 Address Control
        // 000: Originator-ID 24 bit; no Destination-ID
        // 001: Originator-ID 32 bit; no Destination-ID
        // 010: Originator-ID 32 bit, Destination-ID 32 bit
        // 011: Originator-ID 48 bit, no Destination-ID
        // 100: reserved    101: reserved    110: reserved    111: reserved
        let originatorIdLength = 0;
        let destinationIdLength = 0;
        if (addressControl === 0b000) { originatorIdLength = 3; }
        if (addressControl === 0b001) { originatorIdLength = 4; }
        if (addressControl === 0b010) { originatorIdLength = 4; destinationIdLength = 4; }
        if (addressControl === 0b011) { originatorIdLength = 6; }

        // Bit 0…3 Telegram type (R-ORG)
        // 0000: RPS telegram (0xF6)
        // 0001: 1BS telegram (0xD5)
        // 0010: 4BS telegram (0xA5)
        // 0011: Smart Acknowledge Signal telegram (0xD0)
        // 0100: Variable length data telegram (0xD2)
        // 0101: Universal Teach-In EEP based (0xD4)
        // 0110: Manufacturer Specific Communication (0xD1)
        // 0111: Secure telegram (0x30)
        // 1000: Secure telegram with encapsulation (0x31)
        // 1001: Secure Teach-In telegram for switch (0x35)
        // 1010: Generic Profiles selective data (0xB3)
        // 1011: reserved
        // 1100: reserved
        // 1101: reserved
        // 1110: reserved
        // 1111: Extended Telegram type available

        // ----------------------------------------
        // Extended Header

        let extendedHeader;
        if (extendedHeaderAvailable === 0b1) {
            extendedHeader = parseInt(esp3RawData.substr(index, 2), 16);
            index += 2;
            // FIXME in the future. { repeaterCount, lengthOfOptionalData }.
        }

        // ----------------------------------------
        // Extended Telegram type

        // Available when  1111: Extended Telegram type available
        let extendedTelegramType;
        if (telegramType === 0b1111) {
            extendedTelegramType = parseInt(esp3RawData.substr(index, 2), 16);
            index += 2;
            // FIXME in the future. undefined OR string.
        }

        // ----------------------------------------
        // Originator-ID

        let originatorId;
        if (originatorIdLength) {
            originatorId = esp3RawData.substr(index, originatorIdLength * 2);
            index += originatorIdLength * 2;
        }

        // ----------------------------------------
        // Destination-ID

        let destinationId;
        if (destinationIdLength) {
            destinationId = esp3RawData.substr(index, destinationIdLength * 2);
            index += destinationIdLength * 2;
        }

        // ----------------------------------------
        // Data_DL  (The Data_DL field contains the payload of the telegram.)

        let dataDL;
        if (telegramType === 0b0000 || telegramType === 0b0001) { // RPS || 1BS
            dataDL = esp3RawData.substr(index, 2);
            index += 2;
        } else if (telegramType === 0b0010) { // 4BS
            dataDL = esp3RawData.substr(index, 8);
            index += 8;
        } else if (telegramType === 0b0100) { // VLD
            // 取り急ぎ VLD Telegram のデータ長さは3Byte長とする
            // TODO: 正式なパースの仕方をどうするか要検討
            dataDL = esp3RawData.substr(index, 6);
            index += 6;
        } else if (telegramType === 0b1111) { // EXT
            if (extendedTelegramType === 0x07) { // EXTの場合は長さが一定でないため、残りのパラメータ全てを代入する
                dataDL = esp3RawData.substr(index);
                index = esp3RawData.length;
            }
        }

        // ----------------------------------------

        return {
            header: {
                addressControl,
                extendedHeaderAvailable,
                telegramType,
            },
            extendedHeader,
            extendedTelegramType,
            originatorId,
            destinationId,
            dataDL,
            optionalData,
            crc: '',
        };
    };

    /**
     * Remove duplicated ID to exclude phantom telegram
     * @param {Array<object>} espArray
     * @param {*} node this
     * @returns {Array<object>} ESP array of Unique ID
     */
    const removeDuplicatedId = ([...array], node) => {
        const originatorIdArray = array.map((esp) => esp.originatorId);
        // return only unique originatorId
        const uniqueArray = array.filter((value, index) => {
            const firstIndex = originatorIdArray.indexOf(value.originatorId);
            const lastIndex = originatorIdArray.lastIndexOf(value.originatorId);
            if (firstIndex === lastIndex) {
                return true;
            }
            if (index === firstIndex) {
                node.warn(`Duplicated EnOcean ID recieved instantly, excluded: ${value.originatorId}.`);
            }
            return false;
        });
        return uniqueArray;
    };

    // EnOcean-com node function definition
    function EnOceanComNode(config) {
        RED.nodes.createNode(this, config);

        try {
            if (config.emu) {
                // read data form globalcontext
                let gContext = this.context().global;
                let EnOceanSim = gContext.get ("EnOceanSimulator");
    
                // make buffer from data
                // puy it to a stream
                this.port = stream.Readable.from(EnOceanSim);
            } else {
                this.port = new SerialPort(config.serialPort, { baudRate: BAUDRATE });
            }
        }
        catch (err){
            node.error("Invalid serial port");
            return;
        }

        const InterByteTimeout = require('@serialport/parser-inter-byte-timeout');
        this.parser = this.port.pipe(new InterByteTimeout({ interval: INTERBYTETIMEOUT }));
        var node = this;
        /**
         * linkObjの構造
         * {
         *     <sensorId>: [
         *         {
         *             sensorId: "1234A5C2",
         *             value: "0x12a4b5",
         *             optionalData: "0xa6",  // 電界強度
         *             objectKey: "key",
         *             nodeId: "nodeId"
         *             qInfo: "Quality Info." // 品質情報送信が設定されている場合のみ
         *         }
         *     ]
         * }
         */
        var linkObj = {};

        if (this.parser) {
            this.parser.on('data', function (data) {
                const erp2Array = [];
                const espArray = pickupEspPacketAsObject(data);
                espArray.forEach((esp) => {
                    if (esp.syncByte !== '55') {
                        node.error(`Invalid syncByte ${esp.syncByte}`);
                        return;
                    }
                    if (esp.header.dataLengthAsInt <= 6) {
                        node.error(`Data Length (${esp.header.dataLength}) is less than 6 bytes.`);
                        return;
                    }
                    if (esp.header.packetType !== '0a') {
                        node.error(`This node only supports ESP3 Packet Type 10 (RADIO_ERP2), Ignore ${esp.header.packetType}`);
                        return;
                    }
                    // Excluded due to supporting multi teregram
                    // // check phantom telegram
                    // if (data.length > esp.header.dataLengthAsInt + 9) {
                    //     node.warn(`consecutive (sub)telegrams might be recieved, the length is ${data.length}`);
                    //     return;
                    // }

                    // check data length
                    if (esp.data.length !== esp.header.dataLengthAsInt * 2) {
                        node.warn(`Aquired data length is wrong to the setting of header. data: ${esp.data}, length setting: ${esp.header.dataLengthAsInt}`);
                        return;
                    }

                    // Header CRC Check
                    const espHeaderBuffer = Buffer.from(`${esp.header.dataLength}${esp.header.optionalLength}${esp.header.packetType}`, 'hex');
                    const computedCrc8hNumber = crc8.compute(espHeaderBuffer);
                    const computedCrc8h = (`00${computedCrc8hNumber.toString(16)}`).slice(-2);
                    if (computedCrc8h !== esp.crc8h) {
                        node.warn(`Failed to header CRC check. header: ${esp.crc8h} computed: ${computedCrc8h}`);
                        return;
                    }

                    // Data CRC Check
                    const espDataBuffer = Buffer.from(`${esp.data}${esp.optionalData}`, 'hex');
                    const computedCrc8dNumber = crc8.compute(espDataBuffer);
                    const computedCrc8d = (`00${computedCrc8dNumber.toString(16)}`).slice(-2);
                    if (computedCrc8d !== esp.crc8d) {
                        node.warn(`Failed to data CRC check. data: ${esp.crc8d} computed: ${computedCrc8d}`);
                        return;
                    }

                    // --- ERP2 ---
                    const erp2 = pickupErp2DataAsObject(esp.data, esp.optionalData);
                    erp2Array.push(erp2)
                });
                
                // remove duplicated originatorId(check phantom telegram)
                const uniqueErp2Array = removeDuplicatedId(erp2Array, node)
                uniqueErp2Array.forEach((erp2) => {
                    if (erp2.originatorId) {
                        node.debug(`Originator ID = ${erp2.originatorId}`);
                    } else {
                        node.error('Originator-ID is empty.');
                        return;
                    }

                    // リピーター経由のデータであればデバッグ出力する
                    if (erp2.extendedHeader) {
                        node.debug('This connection went throuth Repeater');
                    }

                    node.debug(`radio data = ${erp2.dataDL}`);

                    const listeners = propagateReceivedValue(erp2.originatorId, erp2.dataDL, erp2.optionalData);
                    node.debug(`listeners = ${JSON.stringify(listeners)}`);

                    // 通知先のノード（EnOcean-obj）があればそちらに通知する
                    listeners.filter((l) => l.nodeId).forEach((listener) => {
                        const enObjNode = RED.nodes.getNode(listener.nodeId);
                        node.debug(util.inspect(enObjNode));
                        if (enObjNode) {
                            enObjNode.emit('changeListener', listener.objectKey);
                        }
                    });
                });
            });
        } else {
            this.error(RED._('serial.errors.missing-conf'));
        }

        /**
         * @return {array} - [{ nodeId, objectKey },,,]
         */
        var propagateReceivedValue = (receivedSensorId, data, optionalData) => {
            const listeners = [];
            // Pick up sensor node that has same sensorId.
            const linkData = linkObj[receivedSensorId];
            if (!linkData || linkData.length === 0) {
                node.debug(`Sensor ID '${receivedSensorId}' received but there's no node with matched id.`);
            } else {
                linkData.forEach((e) => {
                    e.value = `0x${data}`;
                    // optionalDataはSubTelNumとdBmであり、返却するのはdBmのみで良いため分割する
                    if (optionalData.length === 4) {
                        const dBm = optionalData.substring(2);
                        e.optionalData = `0x${dBm}`;
                    }
                    if (e.nodeId) { // TODO: この条件は必要ないか？？
                        // Add/overwrite to list.
                        listeners.push({ nodeId: e.nodeId, objectKey: e.objectKey });
                        node.debug(`listeners.push({ nodeId: ${e.nodeId}, objectKey: ${e.objectKey} });`);
                    }
                });
            }
            return listeners;
        };

        this.on('addLinkData', (lObj) => {
            // lObjのチェック
            if (!lObj || !lObj.sensorId || !lObj.nodeId || !lObj.objectKey) {
                // 必要な要素が含まれていないため何もしない
                node.error('The required elements are not included in the addLinkData event.');
                return;
            }
            // sensorId(16進数の文字列)はすべて小文字で扱う
            const sensorId = lObj.sensorId.toLowerCase();
            // linkObjに新たなリンクデータを追加
            if (!linkObj[sensorId]) {
                linkObj[sensorId] = [];
            }
            linkObj[sensorId].push(lObj);
            node.trace(`lObj = ${JSON.stringify(lObj)}`);
            node.trace(`linkObj = ${JSON.stringify(linkObj)}`);
        });

        this.on('close', function (done) {
            if (this.port) {
                this.port.close(done);
            } else {
                done();
            }
        });
    }

    RED.nodes.registerType('EnOcean-com', EnOceanComNode);
};
