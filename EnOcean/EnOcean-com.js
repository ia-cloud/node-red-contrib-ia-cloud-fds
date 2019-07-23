module.exports = function(RED) {
    "use strict";
    var settings = RED.settings;
    var events = require("events");
    var serialp = require("serialport");
    //var crc = require("crc");
    //const { crc81wire } = require('crc');
    const CRC = require('crc-full').CRC;
    var moment = require("moment");
    var fs = require("fs");

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
            // 取り急ぎ VLD Telegram のデータ長さは3Byte長とする
            // TODO: 正式なパースの仕方をどうするか要検討
            result['radio_data'] = data.slice(index, index+6);
            index += 6;
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
        this.serialPool = this.serialConfig.serialpool;
        var gContext = this.context().global;
        var node = this;
        var linkObj = [];
        var listeners = {};
        var serialPool = this.serialPool;

        if (this.serialConfig) {
            var node = this;
            node.status({fill:"grey",shape:"dot",text:"node-red:common.status.not-connected"});
            node.port = this.serialPool.get(this.serialConfig);
            
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
                // 計算したCRCの0パディング (2桁)
                calc_crc = ('00' + calc_crc).slice(-2);
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
                // 計算したCRCの0パディング (2桁)
                calc_crc = ('00' + calc_crc).slice(-2);
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
                
                MakeListeners(data_info.originId, data_info.radio_data);
                node.log('listeners = ' + JSON.stringify(listeners));
                
                // 通知先のノード（EnOcean-obj）があればそちらに通知する
                Object.keys(listeners).forEach(function(nodeId) {
                    if (nodeId) {
                        var EnObjNode = RED.nodes.getNode(nodeId);
                        node.log('nodeId = ' + nodeId + ', EnObjNode = ' + JSON.stringify(EnObjNode));
                        if (EnObjNode) EnObjNode.linkDatachangeListener(listeners[nodeId]);
                    }
                });
                listeners = {};     // 通知先をクリアする
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

        var MakeListeners = function(sensor_id, data){
            var linkData = linkObj.filter(function(elm) {
                var lower_id = elm.sensor_id.toLowerCase();  // Sensor IDを一旦小文字に合わせる
                return (lower_id == sensor_id);
            });
            if (linkData.length > 0) {
                // 一つ以上の要素が見つかったら
                for (var i = 0; i < linkData.length; i++) {
                    linkData[i].value = data;
                    var nodeId = linkData[i].nodeId;
                    if (nodeId) {
                        // リストに追加（または上書き）
                        listeners[nodeId] = [linkData[i].objectKey,linkData[i].value];
                        node.log('listeners[' + nodeId + '] = ' + listeners[nodeId]);
                    }
                }
                //node.log('$$$$$ A specified sensor ID is found in linkObj [' + linkData.sensor_id + ']');
                //node.log('$$$$$ The received data is set into listeners array list.');
            } else {
                node.log('[ERROR] Sensor-ID [' + sensor_id + '] is not found in linkObj');
            }
        }

        EnOceanComNode.prototype.addLinkData = function (lObj) {
            // linkObjに新たなリンクデータを追加
            Array.prototype.push.apply(linkObj, lObj);
            node.log('lObj = ' + JSON.stringify(lObj));
            node.log('linkObj = ' + JSON.stringify(linkObj));
        }

        this.on("close", function(done) {
            if (this.serialConfig) {
                // TODO: serialPoolをSerialPortノードから取得するように変更する
                this.serialPool.close(this.serialConfig.serialport,done);
            }
            else {
                done();
            }
        });
    }
    RED.nodes.registerType("EnOcean-com",EnOceanComNode);
    
}
