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
        this.qInfo = config.qInfo;
        this.qInterval = parseInt(config.qInterval, 10);
        this.intervalId = [];

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
        EnObjects[0].qInfo = this.qInfo;
        EnObjects[0].qInterval = this.qInterval;

        if (EnObjects) {
            // 取り合えず EnObjects は要素数1としてコードを書く
            for (let i = 0; i < EnObjects.length; i++) {
                linkData = {};
                linkData.sensorId = EnObjects[i].options.sensorId;
                linkData.nodeId = node.id;
                linkData.objectKey = EnObjects[i].objectKey;
                // 品質情報ステータス設定がtrueならば"good"を初期設定する
                if (EnObjects[i].qInfo) linkData.quality = 'good';
                linkObj.push(linkData);
                // EnOcean-com nodeのデータ追加メソッドを呼ぶ
                enCom.emit('addLinkData', linkData);
            }
        }

        node.status({ fill: 'green', shape: 'dot', text: 'status.ready' });

        const iaCloudObjectSend = function (element, quality = undefined) {
            node.status({ fill: 'blue', shape: 'ring', text: 'runtime.preparing' });

            const sendMsg = { request: 'store', dataObject: { objectContent: {} } };

            const iaObject = EnObjects.find((objItem) => {
                node.debug(`objItem.objectKey = ${objItem.objectKey}`);
                node.debug(`element[0] = ${element[0]}`);
                return (objItem.objectKey === element[0]);
            });

            if (iaObject) {
                sendMsg.dataObject.objectKey = element[0];
                sendMsg.dataObject.timestamp = moment().format();
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
                if (iaObject.qInfo) {
                    // 品質情報を設定し、該当ObjectのtimeCountを初期化
                    sendMsg.dataObject.quality = quality;
                    iaObject.timeCount = iaObject.qInterval;
                }
                sendMsg.payload = contentData;
                node.debug(JSON.stringify(sendMsg.dataObject));
                node.send(sendMsg);
                // node.status({fill:'green', shape:'dot', text:'runtime.sent'});
                node.status({ fill: 'green', shape: 'dot', text: 'status.received' });
            } else {
                node.warn('!!! 受信したobjectKeyは設定情報の中には含まれません。メッセージ送信はしません。 !!!');
            }
        };

        // 品質情報による定期送信処理
        const minCycle = 1;
        EnObjects.forEach((obj, i) => {
            if (obj.qInfo && obj.qInterval) {
                obj.timeCount = obj.qInterval;
                this.intervalId[i] = setInterval(() => {
                    // node.debug(`${objectKey} timeCount: ${obj.timeCount}`);
                    // 設定された格納周期で,PLCCom Nodeからデータを取得し、ia-cloudオブジェクトを
                    // 生成しメッセージで送出
                    // 複数の周期でオブジェクトの格納をするため、1秒周期でカウントし、カウントアップしたら、
                    // オブジェクト生成、メッセージ出力を行う。

                    // 収集周期前であれば何もせず
                    obj.timeCount -= minCycle;
                    if (obj.timeCount > 0) return;

                    // 収集周期がきた。収集周期を再設定。
                    obj.timeCount = obj.qInterval;
                    // objectKeyに対応するlinkDataを探す
                    const linkDataList = linkObj.filter((ld) => ld.objectKey === obj.objectKey);
                    if (linkDataList && linkDataList.length > 0 && linkDataList[0].value) {
                        // linkDataの品質情報ステータスを"not updated"にする
                        linkDataList[0].quality = 'not updated';
                        // 引数に [objectKey, radio_data] を受け取る
                        iaCloudObjectSend([obj.objectKey, linkDataList[0].value], linkDataList[0].quality);
                        node.status({ fill: 'yellow', shape: 'ring', text: 'status.notUpdated' });
                    }
                }, (minCycle * 1000));
            }
        });

        // EnOceanObjNode.prototype.linkDatachangeListener = function (element) {
        this.on('changeListener', ((objectKey) => {
            // objectKeyに対応するlinkDataを探す
            const linkDataList = linkObj.filter((ld) => ld.objectKey === objectKey);
            if (linkDataList && linkDataList.length > 0) {
                // linkDataに品質情報ステータスがあれば"good"にする
                if (linkDataList[0].quality) linkDataList[0].quality = 'good';
                // 引数に [objectKey, radio_data] を受け取る
                iaCloudObjectSend([objectKey, linkDataList[0].value], linkDataList[0].quality);
            }
        }));

        this.on('input', function (msg) {
            // 処理なし
        });

        this.on('close', function (done) {
            // 周期実行を停止
            this.intervalId.forEach((id) => clearInterval(id));
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
