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
