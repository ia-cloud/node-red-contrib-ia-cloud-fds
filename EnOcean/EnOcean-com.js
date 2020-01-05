module.exports = function (RED) {
    'use strict';

    const crc8 = require('crc-full').CRC.default('CRC8');

    /**
     * Pick up "Sync. Byte", "Header" and "CRC8H" from receivedEspData.
     * @param {Buffer} receivedEspData
     * @returns {object} ESP3 Packet as object.
     */
    const pickupEspPacketAsObject = (receivedEspData) => {
        const syncByte = receivedEspData.slice(0, 1).toString('hex'); // receivedEspData[0].toString(16),
        const dataLength = receivedEspData.slice(1, 3).toString('hex');
        const optionalLength = receivedEspData.slice(3, 4).toString('hex');
        const packetType = receivedEspData.slice(4, 5).toString('hex');
        const crc8h = receivedEspData.slice(5, 6).toString('hex');
        //
        const dataLengthAsInt = parseInt(dataLength, 16);
        const optionalLengthAsInt = parseInt(optionalLength, 16);
        const offsetOptionalData = 6 + dataLengthAsInt;
        const offsetCrc8d = offsetOptionalData + optionalLengthAsInt;
        //
        const data = receivedEspData.slice(6, offsetOptionalData).toString('hex');
        const optionalData = receivedEspData.slice(offsetOptionalData, offsetCrc8d).toString('hex');
        const crc8d = receivedEspData.slice(offsetCrc8d).toString('hex');

        return {
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
        };
    };

    /**
     * Pick up individual data from ESP2 data.
     * @param {string} esp3RawData
     * @returns {object} ERP2 data
     * @see {@link EnOceanRadioProtocol2.pdf} 4.5 Data contents for Length > 6 Bytes
     */
    const pickupErp2DataAsObject = (esp3RawData) => {
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
            if (extendedTelegramType === 0x07) { // In case of GP // 0x07: Generic Profiles Complete data (0xB2)
                dataDL = esp3RawData.substr(index, 10);
                index += 10;
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
            optionalData: '',
            crc: '',
        };
    };

    // EnOcean-com node function definition
    function EnOceanComNode(n) {
        RED.nodes.createNode(this, n);
        this.serial = n.serial;
        this.serialConfig = RED.nodes.getNode(this.serial);
        this.serialPool = this.serialConfig.serialpool;
        var node = this;
        var linkObj = [];
        var listeners = {};

        if (this.serialConfig) {
            node.port = this.serialPool.get(this.serialConfig);

            this.port.on('data', function (msgout) {
                const esp = pickupEspPacketAsObject(msgout.payload);

                if (esp.syncByte !== '55') {
                    node.log(`Invalid syncByte ${esp.syncByte}`);
                    return;
                }
                if (esp.header.dataLengthAsInt <= 6) {
                    node.log(`Data Length (${esp.header.dataLength}) is less than 6 bytes.`);
                    return;
                }
                if (esp.header.packetType !== '0a') {
                    node.log(`This node only supports ESP3 Packet Type 10 (RADIO_ERP2), Ignore ${esp.header.packetType}`);
                    return;
                }

                // Header CRC Check
                const espHeaderBuffer = Buffer.from(`${esp.header.dataLength}${esp.header.optionalLength}${esp.header.packetType}`, 'hex');
                const computedCrc8hNumber = crc8.compute(espHeaderBuffer);
                const computedCrc8h = (`00${computedCrc8hNumber.toString(16)}`).slice(-2);
                if (computedCrc8h !== esp.crc8h) {
                    node.log(`Failed to header CRC check. header: ${esp.crc8h} computed: ${computedCrc8h}`);
                    return;
                }

                // Data CRC Check
                const espDataBuffer = Buffer.from(`${esp.data}${esp.optionalData}`, 'hex');
                const computedCrc8dNumber = crc8.compute(espDataBuffer);
                const computedCrc8d = (`00${computedCrc8dNumber.toString(16)}`).slice(-2);
                if (computedCrc8d !== esp.crc8d) {
                    node.log(`Failed to data CRC check. data: ${esp.crc8d} computed: ${computedCrc8d}`);
                    return;
                }

                // --- ERP2 ---
                const erp2 = pickupErp2DataAsObject(esp.data, esp.optionalData);

                if (erp2.originatorId) {
                    node.debug(`Originator ID = ${erp2.originatorId}`);
                } else {
                    node.log('Originator-ID is empty.');
                    return;
                }

                node.debug(`radio data = ${erp2.dataDL}`);

                propagateReceivedValue(erp2.originatorId, erp2.dataDL);
                node.log('listeners = ' + JSON.stringify(listeners));

                // 通知先のノード（EnOcean-obj）があればそちらに通知する
                Object.keys(listeners).forEach(function (nodeId) {
                    if (nodeId) {
                        var EnObjNode = RED.nodes.getNode(nodeId);
                        node.log('nodeId = ' + nodeId + ', EnObjNode = ' + JSON.stringify(EnObjNode));
                        if (EnObjNode) EnObjNode.linkDatachangeListener(listeners[nodeId]);
                    }
                });
                listeners = {}; // 通知先をクリアする
            });
        } else {
            this.error(RED._('serial.errors.missing-conf'));
        }

        var propagateReceivedValue = function (receivedSensorId, data) {
            // Pick up sensor node that has same sensorId.
            const linkData = linkObj.filter((e) => {
                if (e.sensor_id === receivedSensorId) return true;
                return parseInt(e.sensor_id, 16) === parseInt(receivedSensorId, 16);
            });
            if (linkData.length === 0) {
                node.debug(`Sensor ID "${receivedSensorId}" received but there's no node with matched id.`);
            } else {
                linkData.forEach(function (e) {
                    e.value = data;
                    if (e.nodeId) {
                        // Add/overwrite to list.
                        const objectKeyAndValueArray = [e.objectKey, e.value];
                        listeners[e.nodeId] = objectKeyAndValueArray;
                        node.log(`listeners[${e.nodeId}] = ${objectKeyAndValueArray}`);
                    }
                });
            }
        };

        EnOceanComNode.prototype.addLinkData = function (lObj) {
            // linkObjに新たなリンクデータを追加
            Array.prototype.push.apply(linkObj, lObj);
            node.log('lObj = ' + JSON.stringify(lObj));
            node.log('linkObj = ' + JSON.stringify(linkObj));
        }

        this.on('close', function (done) {
            if (this.serialConfig) {
                // TODO: serialPoolをSerialPortノードから取得するように変更する
                this.serialPool.close(this.serialConfig.serialport, done);
            } else {
                done();
            }
        });
    }

    RED.nodes.registerType('EnOcean-com', EnOceanComNode);
}
