const moment = require('moment');

/**
 * msg.payload.temperatureのような値の取り方を解決する.
 */
const resolvePayload = (msg, key) => {
    const keyArray = key.split('.');
    if (keyArray.length === 1) {
        return msg[keyArray.shift()];
    }
    return resolvePayload(msg[keyArray.shift()], keyArray.join('.'));
};

/**
 * exportsするfunctionの定義.
 * @see https://nodered.jp/docs/creating-nodes/node-js
 * @param {object} RED - Node-REDで決められているお作法.
 */
function exportsFunction(RED) {
    /**
     * registerTypeで登録するfunctionの定義.
     * @see https://nodered.jp/docs/creating-nodes/node-js#ノードコンストラクタ
     * @param {object} config
     */
    function nodeFunction(config) {
        const thisNode = this;
        RED.nodes.createNode(thisNode, config);

        // inputイベント(ノードがメッセージを受信)へのリスナー登録.
        this.on('input', (message) => {
            (async (msg) => {
                if (!config.rules || config.rules.length === 0) {
                    // No change rule configured.
                    return;
                }

                if (typeof msg.payload === 'object') {
                    // ex. msg.payload = {};
                } else {
                    // ex. msg.payload = 46;
                }

                // Change values with rules.
                const contentData = config.rules
                    .filter((rule) => rule.value && rule.dataName)
                    .map((rule) => {
                        const contentDatum = {
                            dataValue: resolvePayload(msg, rule.value),
                            dataName: rule.dataName,
                            commonName: rule.commonName,
                        };
                        if (rule.unit) { contentDatum.unit = rule.unit; }
                        return contentDatum;
                    });

                // Variables

                const dataObject = {
                    objectType: 'iaCloudObject',
                    objectKey: config.objectKey,
                    timestamp: moment().format(),
                    objectContent: {
                        contentType: 'iaCloudData',
                        contentData,
                    },
                };
                // Optional keys.
                if (config.objectDescription) { dataObject.objectDescription = config.objectDescription; }
                if (config.instanceKey) { dataObject.instanceKey = config.instanceKey; }

                msg = {
                    request: 'store',
                    // serviceID,
                    dataObject,
                };

                thisNode.send(msg);
            })(message).catch((err) => {
                thisNode.error(err, message);
            });
        });

        /**
         * closeイベント(ノードの編集ダイアログを閉じる時)へのリスナー登録.
         * @see https://nodered.jp/docs/creating-nodes/node-js#ノードを閉じる
         */
        thisNode.on('close', function (removed, done) {
            if (removed) {
                // This node has been deleted
            } else {
                // This node is being restarted
            }
            done();
        });
    }

    RED.nodes.registerType('ia-cloud-change', nodeFunction, {
        // credentials
    });
}

module.exports = exportsFunction;
