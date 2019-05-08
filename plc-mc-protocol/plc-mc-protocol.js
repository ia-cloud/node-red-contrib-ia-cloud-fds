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
      console.log(err); // TODO Node-RED流の何かしらのエラーアプローチ.
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
      const values = await readItemsFromPLC({
        host: '192.168.1.56',
        port: 5011,
        items: {
          D0: 1,
          D1: 1,
          D2: 2
        },
      });
      // 取得結果のセット.
      msg.payload = values;
      thisNode.send(msg);
    });
  }

  RED.nodes.registerType('plc-mc-protocol', nodeFunction, {
    // credentials
  });
}

module.exports = exportsFunction;
