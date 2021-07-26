
var HmiEngine = require('./HMI-Schneider-Engine');

module.exports = function (RED) {
  "use strict";

  function HmiSchneider(config) {

    RED.nodes.createNode(this, config);

    this._engine = new HmiEngine(RED, this, RED.nodes.getNode(config.HmiSchneiderCom), true);

    // Nodeステータスを、preparingにする。
    this.status(this._engine.NodeStatus.Preparing);

    // プロパティを読み込んでオブジェクトを生成
    let obj = { objectContent: {} };
    obj.asyncInterval = config.storeAsync ? 1 : 0;
    obj.storeInterval = config.storeInterval;
    obj.objectKey = config.objectKey;
    obj.objectDescription = config.objectDescription;
    obj.objectContent.contentType = config.contentType;
    obj.objectContent.contentData = [];
    config.dataItems.forEach(item => { obj.objectContent.contentData.push(Object.assign({}, item)); });
    this._engine.addObject(obj);

    // Nodeステータスを変更
    this.setWebSocketStatus = function () {
      this.status(this._engine.getNodeState());
    };
    this.setWebSocketStatus();

    this.on("statusChanged", function () {
      this.setWebSocketStatus();
    });

    this.on("outputMsg", function (msg) {
      this.status(this._engine.NodeStatus.Preparing);
      this.send(msg);
      this.status(this._engine.NodeStatus.Sent);

      this.setWebSocketStatus();
    });

    this.on("input", function (msg) {
      this._engine.outputMsgs(msg);
    });

    this.on("close", function () {
      if (this._engine) {
        this._engine.dispose();
        this._engine = null;
      }
    });
  }

  RED.nodes.registerType("HMI-Schneider", HmiSchneider);
}
