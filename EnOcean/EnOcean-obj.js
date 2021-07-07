module.exports = function (RED) {
    'use strict';

    const moment = require('moment');
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

        const { serialPool } = config.enoceancom;

        const node = this;
        const enCom = RED.nodes.getNode(this.enoceancom);
        if (enCom == null) {
            node.warn(`[ERROR] EnOcean-com node is not specified. [object = ${enCom}]`);
            node.status({ fill: 'red', shape: 'ring', text: 'status.noEnOceanCom' });
            return false;
        }
        const linkObj = [];
        let linkData = {};
        let EnObjects = [{}];
        node.status({ fill: 'blue', shape: 'ring', text: 'runtime.preparing' });

        // オブジェクトがプロパティで設定されている場合、プロパティを読み込んでオブジェクトを生成
        // var EnDataNode = (RED.nodes.getNode(config.enoceandataitem));

        // TODO: センサー種別からオブジェクトをどう取り出すかを検討する
        const sensorObj = config.selectSensor;
        // var sensorObj = '';
        // if ( config.sensorKind == 'u-rd' ) {
        //    sensorObj = config.urd_ac_sensor;
        // } else {
        //    sensorObj = config.watty_temp_sensor;
        // }
        const SensorNode = RED.nodes.getNode(sensorObj);
        if (SensorNode == null) {
            node.warn(`[ERROR] Sensor Object is not specified. [object = ${SensorNode}]`);
            node.status({ fill: 'red', shape: 'ring', text: 'status.noSensor' });
            return false;
        }
        node.trace(`SensorNode = ${JSON.stringify(SensorNode)}`);
        node.trace(`SensorNode.configObject = ${JSON.stringify(SensorNode.configObject)}`);

        EnObjects = [{ options: {}, objectContent: {} }];
        EnObjects[0].options.sensorId = SensorNode.sensorId;
        EnObjects[0].options.sensorKind = config.sensorKind;
        EnObjects[0].objectName = 'ObjectName'; // 仮設定
        EnObjects[0].objectKey = config.object_key;
        EnObjects[0].objectDescription = config.object_desc;
        EnObjects[0].objectContent.contentType = 'iaCloudData';
        EnObjects[0].objectContent.contentData = SensorNode.configObject;

        if (EnObjects) {
            // 取り合えず EnObjects は要素数1としてコードを書く
            for (let i = 0; i < EnObjects.length; i++) {
                linkData = {};
                linkData.sensorId = EnObjects[i].options.sensorId;
                linkData.nodeId = node.id;
                linkData.objectKey = EnObjects[i].objectKey;
                linkObj.push(linkData);
                // EnOcean-com nodeのデータ追加メソッドを呼ぶ
                enCom.emit('addLinkData', linkData);
            }
        }

        node.status({ fill: 'green', shape: 'dot', text: 'status.ready' });

        const iaCloudObjectSend = function (element) {
            node.status({ fill: 'blue', shape: 'ring', text: 'runtime.preparing' });

            const sendMsg = { request: 'store', dataObject: { objectContent: {} } };

            const iaObject = EnObjects.find((objItem) => {
                node.debug(`objItem.objectKey = ${objItem.objectKey}`);
                node.debug(`element[0] = ${element[0]}`);
                return (objItem.objectKey === element[0]);
            });

            if (iaObject) {
                sendMsg.dataObject.objectKey = element[0];
                sendMsg.dataObject.timeStamp = moment().format();
                sendMsg.dataObject.objectType = 'iaCloudObject';
                sendMsg.dataObject.objectDescription = iaObject.objectDescription;
                sendMsg.dataObject.objectContent.contentType = 'iaCloudData';

                const { options } = iaObject;
                node.debug(`options = ${JSON.stringify(options)}`);
                // 関数を取り出す
                const sensor = sensors.find((s) => s.type === options.sensorKind); // TODO Refactor sensorKind to sensorType, naming s, ss.
                const sensorValues = sensor ? sensor.process(element[1]) : [];
                if (sensor) {
                    node.debug(`${sensor.name} value = ${sensorValues}`);
                }

                const { contentData } = iaObject.objectContent;
                contentData.some((dItem, idx) => {
                    if ((idx + 1) > sensorValues.length) {
                        return true;
                    }
                    dItem.dataValue = sensorValues[idx];
                    return false;
                });

                sendMsg.dataObject.objectContent.contentData = contentData;
                sendMsg.payload = contentData;
                node.debug(JSON.stringify(sendMsg.dataObject));
                node.send(sendMsg);
                // node.status({fill:'green', shape:'dot', text:'runtime.sent'});
                node.status({ fill: 'green', shape: 'dot', text: 'status.received' });
            } else {
                node.warn('!!! 受信したobjectKeyは設定情報の中には含まれません。メッセージ送信はしません。 !!!');
            }
        };
        // EnOceanObjNode.prototype.linkDatachangeListener = function (element) {
        this.on('changeListener', ((objectKey) => {
            // objectKeyに対応するlinkDataを探す
            const linkDataList = linkObj.filter(ld => ld.objectKey === objectKey);
            if( linkDataList && linkDataList.length > 0) {
                // 引数に [objectKey, radio_data] を受け取る
                iaCloudObjectSend([objectKey, linkDataList[0].value]);
            }
        }));

        this.on('input', function (msg) {
            // 処理なし
        });

        this.on('close', function (done) {
            if (this.serialConfig) {
                // TODO: ここのserialPoolをSerialPortノードから取得するようにする
                serialPool.close(this.serialConfig.serialport, done);
            } else {
                done();
            }
        });
    }
    RED.nodes.registerType('EnOcean-obj', EnOceanObjNode);
};
