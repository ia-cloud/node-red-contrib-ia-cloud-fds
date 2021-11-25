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
