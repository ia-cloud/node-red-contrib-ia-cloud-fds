module.exports = function (RED) {
    'use strict';

    const crc8 = require('crc-full').CRC.default('CRC8');

    /**
     * Pick up "Sync. Byte", "Header" and "CRC8H" from receivedEspData.
     * @param {Buffer} receivedEspData
     */
    const pickupEspHeaderAround = (receivedEspData) => ({
        syncByte: receivedEspData.slice(0, 1).toString('hex'), // receivedEspData[0].toString(16),
        header: {
            dataLength: receivedEspData.slice(1, 3).toString('hex'),
            optionalLength: receivedEspData.slice(3, 4).toString('hex'),
            packetType: receivedEspData.slice(4, 5).toString('hex'),
        },
        crc8h: receivedEspData.slice(5, 6).toString('hex'),
    });

    function ParseHeader(header) {
        // ERP2 Header Check
        var result = { orgid_len: 0, destid_len: 0, ext_hdr: false, telegram_type: '', RORG: '', ext_tlg: false };
        var dec = parseInt(header, 16);

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
        var result = { header: null, ext_hdr: null, ext_tlg: null, originId: null, destId: null, radio_data: null };
        var index = 0;
        // Check a length of radio data.
        if (data.length < data_len * 2) {
            return null;
        }

        result['header'] = data.slice(0, 2);
        index += 2;

        if (header_info['ext_hdr']) {
            result['ext_hdr'] = data.slice(index, index + 2);
            index += 2;
        } else {
            result['ext_hdr'] = null;
        }

        if (header_info['ext_tlg']) {
            result['ext_tlg'] = data.slice(index, index + 2);
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
            result['radio_data'] = data.slice(index, index + 2);
            index += 2;
        } else if (header_info['telegram_type'] == '4BS') {
            result['radio_data'] = data.slice(index, index + 8);
            index += 8;
        } else if (header_info['telegram_type'] == 'VLD') {
            // 取り急ぎ VLD Telegram のデータ長さは3Byte長とする
            // TODO: 正式なパースの仕方をどうするか要検討
            result['radio_data'] = data.slice(index, index + 6);
            index += 6;
        } else if (header_info['telegram_type'] == 'EXT') { // Extended Telegram-Type is available
            if (result['ext_tlg'] != null && parseInt(result['ext_tlg'], 16) == 7) { // GPの場合
                result['radio_data'] = data.slice(index, index + 10);
                index += 10;
            } else {
                result['radio_data'] = null;
            }
        } else {
            result['radio_data'] = null; // その他のTypeは解析しない
        }

        return result;
    }

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
                const espHeaderAround = pickupEspHeaderAround(msgout.payload);

                if (espHeaderAround.syncByte !== '55') {
                    node.log(`Invalid syncByte ${espHeaderAround.syncByte}`);
                    return;
                }
                if (parseInt(espHeaderAround.header.dataLength, 16) <= 6) {
                    node.log(`Data Length (${espHeaderAround.header.dataLength}) is less than 6 bytes.`);
                    return;
                }
                if (espHeaderAround.header.packetType !== '0a') {
                    node.log(`This node only supports ESP3 Packet Type 10 (RADIO_ERP2), Ignore ${espHeaderAround.header.packetType}`);
                    return;
                }

                // Header CRC Check
                const espHeaderBuffer = Buffer.from(`${espHeaderAround.header.dataLength}${espHeaderAround.header.optionalLength}${espHeaderAround.header.packetType}`, 'hex');
                const computedCrcNumber = crc8.compute(espHeaderBuffer);
                const computedCrc = (`00${computedCrcNumber.toString(16)}`).slice(-2);
                if (computedCrc !== espHeaderAround.crc8h) {
                    node.log(`Failed to header CRC check. header: ${espHeaderAround.crc8h} computed: ${computedCrc}`);
                    return;
                }

                var en_data = Buffer.from(msgout.payload).toString('hex');
                var data_len = parseInt(espHeaderAround.header.dataLength, 16);
                var opt_len = parseInt(espHeaderAround.header.optionalLength, 16);

                // Data CRC Check
                var pos_crc = 12 + (data_len + opt_len) * 2;
                var check_str = en_data.substr(12, (data_len + opt_len) * 2);
                var data_crc = en_data.substr(pos_crc, 2);
                var calc_crc = crc8.compute(Buffer.from(check_str, 'hex')).toString(16);
                // 計算したCRCの0パディング (2桁)
                calc_crc = ('00' + calc_crc).slice(-2);
                if (calc_crc != data_crc) {
                    node.log(`Failed to data CRC check. data: ${data_crc} computed: ${calc_crc}`);
                    return;
                }
                node.log('Check Data CRC....OK!!  data crc = ' + data_crc + '  compute crc = ' + calc_crc);


                var erp2_hdr = en_data.substr(12, 2);
                node.log('erp2_hdr = ' + erp2_hdr);
                var header_info = ParseHeader(erp2_hdr);
                var data = en_data.substr(12, data_len * 2);
                var data_info = ParseData(data, data_len, header_info);

                if (data_info.originId != null) {
                    node.log('Originator ID = ' + data_info.originId);
                } else {
                    node.log('Originator ID = ---');
                    node.log('parse error : Can not find Originator-ID, so this packet is discarded.');
                    return;
                }
                node.log('radio data = ' + data_info.radio_data);

                propagateReceivedValue(data_info.originId, data_info.radio_data);
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
