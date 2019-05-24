const mc = require('mcprotocol');

const readItemsFromPLC = (param) => new Promise((resolve, reject) => {
  const conn = new mc;
  const doneReading = false;
  const doneWriting = false;
  conn.initiateConnection({
    host: param.host,
    port: param.port,
    ascii: false,
  }, function(err) {
    if (typeof(err) !== 'undefined') { // TODO 後で確認
      // We have an error.  Maybe the PLC is not reachable.
      return reject(err);
    }
    const variables = Object.entries(param.items).map(e => `${e[0]},${e[1]}`);
    // conn.setTranslationCB(function(tag) {return variables[tag];}); 	// This sets the 'translation' to allow us to work with object names defined in our app not in the module
    conn.addItems(variables);
    conn.readAllItems(function(anythingBad, values) {
      if (anythingBad) {
        console.log('SOMETHING WENT WRONG READING VALUES!!!!'); // TODO Node-RED流の何かしらのエラーアプローチ.
        conn.dropConnection();
        return reject('Something went wrong reading values.');
      }
      conn.dropConnection();
      return resolve(values);
    });
  });
});

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

      const host = connectionConfig.host;
      const port = connectionConfig.port;
      const items = {
        D0: 1,
        D1: 1,
        D2: 2,
      };

      readItemsFromPLC({ host, port, items })
        .then((values) => {
          // 取得結果のセット.
          thisNode.status({ fill: 'green', shape: 'dot', text: 'connected' });
          msg.payload = values;
          thisNode.send(msg);
        })
        .catch((e) => {
          // エラー処理.
          thisNode.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
          if (e.code === 'ECONNREFUSED' || e.errno === 'ECONNREFUSED') {
            return;
          }
          thisNode.error(JSON.stringify(e));
          thisNode.debug(JSON.stringify(e));
        });
    });
  }

  RED.nodes.registerType('PLC MC', nodeFunction, {
    // credentials
  });
}

module.exports = exportsFunction;
