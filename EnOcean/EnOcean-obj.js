module.exports = function (RED) {
    'use strict';

    var moment = require('moment');
    const sensors = require('./sensors');

    // EnOcean-obj node function definition
    function EnOceanObjNode(config) {
        RED.nodes.createNode(this, config);
        this.object_key = config.object_key;
        this.object_desc = config.object_desc;
        this.enoceancom = config.enoceancom;
        this.sensorKind = config.sensorKind;
        // this.enoceandataitem = config.enoceandataitem;
        this.urd_ac_sensor = config.urd_ac_sensor;
        this.watty_temp_sensor = config.watty_temp_sensor;
        this.selectSensor = config.selectSensor;

        var serialPool = config.enoceancom.serialPool;

        var node = this;
        var enCom = RED.nodes.getNode(this.enoceancom);
        if (enCom == null) {
            node.warn('[ERROR] EnOcean-com node is not specified. [object = ' + enCom + ']');
            node.status({ fill: 'red', shape: 'ring', text: 'status.noEnOceanCom' });
            return false;
        }
        var linkObj = [];
        var linkData = {};
        var EnObjects = [{}];
        node.status({ fill: 'blue', shape: 'ring', text: 'runtime.preparing' });

        // オブジェクトがプロパティで設定されている場合、プロパティを読み込んでオブジェクトを生成
        // var EnDataNode = (RED.nodes.getNode(config.enoceandataitem));

        // TODO: センサー種別からオブジェクトをどう取り出すかを検討する
        var sensor_obj = config.selectSensor;
        // var sensor_obj = '';
        // if ( config.sensorKind == 'u-rd' ) {
        //    sensor_obj = config.urd_ac_sensor;
        // } else {
        //    sensor_obj = config.watty_temp_sensor;
        // }
        var SensorNode = RED.nodes.getNode(sensor_obj);
        if (SensorNode == null) {
            node.warn('[ERROR] Sensor Object is not specified. [object = ' + SensorNode + ']');
            node.status({ fill: 'red', shape: 'ring', text: 'status.noSensor' });
            return false;
        }
        node.trace('SensorNode = ' + JSON.stringify(SensorNode));
        node.trace('SensorNode.dItems = ' + JSON.stringify(SensorNode.dItems));

        EnObjects = [{ options: {}, objectContent: {} }];
        EnObjects[0].options.sensorId = SensorNode.sensorId;
        EnObjects[0].options.sensorKind = config.sensorKind;
        EnObjects[0].objectName = 'ObjectName'; // 仮設定
        EnObjects[0].objectKey = config.object_key;
        EnObjects[0].objectDescription = config.object_desc;
        EnObjects[0].objectContent.contentType = 'iaCloudData';
        EnObjects[0].objectContent.contentData = SensorNode.dItems;

        if (EnObjects) {
            // 取り合えず EnObjects は要素数1としてコードを書く
            var len = EnObjects.length;
            for (var i = 0; i < len; i++) {
                linkData = {};
                linkData.sensorId = EnObjects[i].options.sensorId;
                linkData.nodeId = node.id;
                linkData.objectKey = EnObjects[i].objectKey;
                linkObj.push(linkData);
            }
        }
        // EnOcean-com nodeのデータ追加メソッドを呼ぶ
        enCom.emit("addLinkData", linkObj);

        node.status({ fill: 'green', shape: 'dot', text: 'status.ready' });

        // EnOceanObjNode.prototype.linkDatachangeListener = function (element) {
        this.on("linkDatachangeListener", function (element){
            // 引数に [objectKey, radio_data] を受け取る
            iaCloudObjectSend(element);
        });
/*
        this.linkDatachangeListener = function (element) {
            // 引数に [objectKey, radio_data] を受け取る
            iaCloudObjectSend(element);
        };
*/
        var iaCloudObjectSend = function (element) {
            node.status({ fill: 'blue', shape: 'ring', text: 'runtime.preparing' });

            var msg = { request: 'store', dataObject: { objectContent: {} } };

            var iaObject = EnObjects.find(function (objItem, idx) {
                node.debug('objItem.objectKey = ' + objItem.objectKey);
                node.debug('element[0] = ' + element[0]);
                return (objItem.objectKey == element[0]);
            });

            if (iaObject) {
                msg.dataObject.objectKey = element[0];
                msg.dataObject.timeStamp = moment().format();
                msg.dataObject.objectType = 'iaCloudObject';
                msg.dataObject.objectDescription = iaObject.objectDescription;
                msg.dataObject.objectContent.contentType = 'iaCloudData';

                var options = iaObject.options;
                node.debug('options = ' + JSON.stringify(options));
                // 関数を取り出す
                const sensor = sensors.find((sensor) => sensor.type === options.sensorKind); // TODO Refactor sensorKind to sensorType, naming s, ss.
                const sensorValues = sensor ? sensor.process(element[1]) : [];
                if (sensor) {
                    node.debug(sensor.name + ' value = ' + sensorValues);
                }

                var contentData = iaObject.objectContent.contentData;
                contentData.some(function (dItem, idx) {
                    if ((idx + 1) > sensorValues.length) {
                        return true;
                    }
                    dItem.dataValue = sensorValues[idx];
                });

                msg.dataObject.objectContent.contentData = contentData;
                msg.payload = contentData;
                node.debug(JSON.stringify(msg.dataObject));
                node.send(msg);
                // node.status({fill:'green', shape:'dot', text:'runtime.sent'});
                node.status({ fill: 'green', shape: 'dot', text: 'status.received' });
            } else {
                node.warn('!!! 受信したobjectKeyは設定情報の中には含まれません。メッセージ送信はしません。 !!!');
            }
        };

        this.on('input', function (msg) {
            // 処理なし
        });

        this.on('close', function (done) {
            if (this.serialConfig) {
                // TODO: ここのserialPoolをSerialPortノードから取得するようにする
                serialPool.close(this.serialConfig.serialport, done);
            }
            else {
                done();
            }
        });
    }
    RED.nodes.registerType('EnOcean-obj', EnOceanObjNode);
}