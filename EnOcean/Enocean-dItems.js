module.exports = function(RED) {
    "use strict";
    var settings = RED.settings;
    var events = require("events");
    var moment = require("moment");
    var fs = require("fs");

    // collect-data-object config node function definition
    function EnOceanDataItemNode(config) {
        RED.nodes.createNode(this,config);
        this.sensor_id = config.sensor_id;
        this.sensor_kind = config.sensor_kind;
        this.configObject = config.configObject;

        var node = this;
        var confObj = config.configObject;
        this.dItems = {};
        if (confObj) {
          try { this.dItems = JSON.parse(confObj); }
          catch(e) {
            // nodeのエラーを通知してして終了
            node.error("runtime:jsonerror", confObj);
          }
        } else {
            // nodeのエラーを通知してして終了
            node.error("runtime:jsonerror", confObj);
        }
        this.on("input",function(msg) {});
        this.on("close",function() {});
    }
    RED.nodes.registerType("EnOcean-dItems",EnOceanDataItemNode);
}