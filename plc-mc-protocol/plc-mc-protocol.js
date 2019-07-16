const MC = require('mcprotocol');
const moment = require('moment');

const readItemsFromPLC = param => new Promise((resolve, reject) => {
  const conn = new MC();
  conn.initiateConnection({
    host: param.host,
    port: param.port,
    ascii: false,
  }, (err) => {
    if (typeof (err) !== 'undefined') {
      // We have an error.  Maybe the PLC is not reachable.
      reject(err);
      return;
    }
    const variables = Object.entries(param.items).map(e => `${e[0]},${e[1]}`);
    // conn.setTranslationCB(function(tag) {return variables[tag];});
    conn.addItems(variables);
    conn.readAllItems((anythingBad, values) => {
      if (anythingBad) {
        conn.dropConnection();
        return reject(new Error('Something went wrong reading values.'));
      }
      conn.dropConnection();
      return resolve(values);
    });
  });
});

const createDataObject = (values, config) => {
  const contentData = [];
  Object.keys(values).forEach((key) => {
    const element = config.addresses.find(e => `${e.dev}${e.addr},${e.len}` === key);
    if (element.sign === 'unsigned') {
    // 正符号への変換が必要な場合
      if (Array.isArray(values[key])) {
        // 取得値が配列の場合
        values[key] = values[key].map((val) => {
          val = parseInt((val >>> 0).toString(16).slice(-4), 16);
          return val;
        })
      } else {
        // 取得値が単独数値の場合
        values[key] = parseInt((values[key] >>> 0).toString(16).slice(-4), 16);
      }
    }
    contentData.push({
      dataName: element.name,
      commonName: element.common || undefined,
      unit: element.unit || undefined,
      dataValue: values[key],
    });
  });
  return {
    request: 'store',
    dataObject: {
      objectKey: config.objectKey,
      timestamp: moment().format(),
      objectType: 'iaCloudObject',
      objectDescription: config.objectDescription || undefined, // オブジェクトの説明
      instanceKey: config.instanceKey || undefined,
      objectContent: {
        contentType: 'iaCloudData', // 基本データモデル
        contentData,
      },
    },
  };
};

// ----------------------------------------

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
    this.on('input', async (msg) => {
      // Retrieve the config node
      const connectionConfig = RED.nodes.getNode(config.connectionConfig);

      if (!connectionConfig) {
        // No config node configured
        msg.payload = undefined;
        thisNode.send(msg);
        return;
      }
      if (!config.addresses || config.addresses.length === 0) {
        // No addresses configured.
        msg.payload = undefined;
        thisNode.send(msg);
        return;
      }

      const { host } = connectionConfig;
      const { port } = connectionConfig;
      const { addresses } = config;
      const items = addresses
        .filter(a => a.dev || a.addr || a.len)
        .reduce((itemsMap, a) => {
          itemsMap[`${a.dev}${a.addr}`] = a.len;
          return itemsMap;
        }, {});

      readItemsFromPLC({ host, port, items })
        .then((values) => {
          // 取得結果のセット.
          thisNode.status({ fill: 'green', shape: 'dot', text: 'connected' });
          msg = createDataObject(values, config);
          thisNode.send(msg);
        })
        .catch((e) => {
          // エラー処理.
          thisNode.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
          if (e.code === 'ECONNREFUSED' || e.errno === 'ECONNREFUSED' || e.errno === 'EHOSTUNREACH' || e.errno === 'ETIMEDOUT') {
            msg.payload = undefined;
            thisNode.send(msg);
            return;
          }
          thisNode.error(JSON.stringify(e));
          thisNode.debug(JSON.stringify(e));
        });
    });
    this.on("close",function(done) {
      setTimeout(done, 5000);
      done();
    });
  }

  RED.nodes.registerType('PLC MC', nodeFunction, {
    // credentials
  });
}

module.exports = exportsFunction;
