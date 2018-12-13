/**
 * Copyright JS Foundation and other contributors, http://js.foundation
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
 **/

module.exports = function(RED) {
    "use strict";
    var request = require("request");
    var moment = require("moment");

    function modbusdItems(config) {

        RED.nodes.createNode(this,config);

        var node = this;
        var confObj = config.configObject;
        this.contentType = config.contentType;
        this.dItems = {};
console.log(confObj);
        if (confObj) {
          try { this.dItems = JSON.parse(confObj); }
          catch(e) {
            // nodeのエラーを通知してして終了
            node.error("JSON parse error on parsing dataItem object", confObj);
          }
        } else {
            // nodeのエラーを通知してして終了
            node.error("JSON parse error on parsing dataItem object", confObj);
        }
        this.on("input",function(msg) {});
        this.on("close",function() {});
    }
    RED.nodes.registerType("Modbus-dItems",modbusdItems);
}
