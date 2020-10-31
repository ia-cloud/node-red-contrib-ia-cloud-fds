/**
 * (C) 2020 URD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const moment = require('moment');
const sensors = require('./sensors');

module.exports = function (RED) {
    // urd-obj node function definition
    function UrdObjNode(config) {
        RED.nodes.createNode(this, config);
        this.objectKey = config.objectKey;
        this.objectDescription = config.objectDescription;
        this.enoceanCom = config.enoceanCom;
        this.sensorType = config.sensorType;
        this.selectSensor = config.selectSensor;

        const { serialPool } = config.enoceanCom;

        const node = this;
        const enoceanCom = RED.nodes.getNode(this.enoceanCom);
        if (enoceanCom == null) {
            node.log(`[ERROR] EnOcean-com node is not specified. [object = ${enoceanCom}]`);
            node.status({ fill: 'red', shape: 'ring', text: 'status.noEnOceanCom' });
            return false;
        }
        const linkObj = [];
        node.status({ fill: 'blue', shape: 'ring', text: 'runtime.preparing' });

        const sensorObj = config.selectSensor;
        const SensorNode = RED.nodes.getNode(sensorObj);
        if (SensorNode == null) {
            node.log(`[ERROR] Sensor Object is not specified. [object = ${SensorNode}]`);
            node.status({ fill: 'red', shape: 'ring', text: 'status.noSensor' });
            return false;
        }
        node.log(`SensorNode = ${JSON.stringify(SensorNode)}`);
        node.log(`SensorNode.configObject = ${JSON.stringify(SensorNode.configObject)}`);

        const enObjects = [{ options: {}, objectContent: {} }];
        enObjects[0].options.sensorId = SensorNode.sensorId;
        enObjects[0].options.sensorType = config.sensorType;
        enObjects[0].objectName = 'ObjectName'; // 仮設定
        enObjects[0].objectKey = config.objectKey;
        enObjects[0].objectDescription = config.objectDescription;
        enObjects[0].objectContent.contentType = 'iaCloudData';
        enObjects[0].objectContent.contentData = SensorNode.configObject;
        enObjects[0].range = SensorNode.range || [];

        if (enObjects) {
            // 取り合えず enObjects は要素数1としてコードを書く
            enObjects.forEach((enObj) => {
                linkObj.push({
                    sensorId: enObj.options.sensorId,
                    nodeId: node.id,
                    objectKey: enObj.objectKey,
                });
            });
        }

        // enoceanCom nodeのデータ追加メソッドを呼ぶ
        enoceanCom.emit('addLinkData', linkObj);
        node.status({ fill: 'green', shape: 'dot', text: 'status.ready' });

        const iaCloudObjectSend = function (element) {
            node.status({ fill: 'blue', shape: 'ring', text: 'runtime.preparing' });

            const msg = { request: 'store', dataObject: { objectContent: {} } };

            const iaObject = enObjects.find((objItem) => {
                node.debug(`objItem.objectKey = ${objItem.objectKey}`);
                node.debug(`element[0] = ${element[0]}`);
                return (objItem.objectKey === element[0]);
            });

            if (iaObject) {
                const { options } = iaObject;
                node.debug(`options = ${JSON.stringify(options)}`);

                // 関数を取り出す
                const sensor = sensors.find((s) => s.type === options.sensorType);

                // センサーに対するcontentDataの作成処理. 3ch sensorの場合は引数にrangeを用いる. 送信対象外のデータはsendFlg: falseとする
                const measuredResult = sensor ? sensor.process(element[1], iaObject.objectContent.contentData) : { contentData: [], message: '', sendFlg: false };

                // 送信対象外のデータは送信処理を行わない
                if (!measuredResult.sendFlg) {
                    node.status({ fill: 'green', shape: 'dot', text: 'status.excluded' });
                    return;
                }

                msg.dataObject = {
                    objectKey: element[0],
                    timeStamp: moment().format(),
                    objectType: 'iaCloudObject',
                    objectDescription: iaObject.objectDescription,
                    objectContent: {
                        contentType: 'iaCloudData',
                        contentData: measuredResult.contentData,
                    },
                };

                node.send(msg);

                if (measuredResult.message) {
                    node.status({ fill: 'yellow', shape: 'dot', text: measuredResult.message });
                } else {
                    node.status({ fill: 'green', shape: 'dot', text: 'status.received' });
                }
            } else {
                node.log('!!! 受信したobjectKeyは設定情報の中には含まれません。メッセージ送信はしません。 !!!');
            }
        };

        // UrdObjNode.prototype.linkDatachangeListener = function (element) {
        this.on('linkDatachangeListener', (element) => {
            // 引数に [objectKey, radio_data] を受け取る
            iaCloudObjectSend(element);
        });

        this.on('input', (msg, send, done) => done()); // 処理なし

        this.on('close', function (done) {
            if (this.serialConfig) {
                // TODO: ここのserialPoolをSerialPortノードから取得するようにする
                serialPool.close(this.serialConfig.serialport, done);
                done();
            } else {
                done();
            }
        });
    }
    RED.nodes.registerType('URD Current Sensor', UrdObjNode);
};
