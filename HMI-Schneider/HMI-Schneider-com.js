
var ComEngine = require('./HMI-Schneider-ComEngine');

module.exports = function (RED) {
  "use strict";

  function hmiSchneiderCom(config) {
    RED.nodes.createNode(this, config);

    this._engine = new ComEngine("ws://" + config.IPAdd + ":" + config.TCPPort + "/api/v1/ws", config.MaxSocket);

    this.getEngine = function () {
      return this._engine;
    }

    this.on("input", function (msg) {
    });

    this.on("close", function () {
      if (this._engine) {
        this._engine.dispose();
        this._engine = null;
      }
    });
  }

  RED.nodes.registerType("HMI-Schneider-com", hmiSchneiderCom);
}
