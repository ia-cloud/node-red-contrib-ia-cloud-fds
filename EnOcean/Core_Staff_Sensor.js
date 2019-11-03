module.exports = function(RED) {
    "use strict";
    var settings = RED.settings;

    // collect-data-object config node function definition
    function Core_Staff_Sensor(config) {
        RED.nodes.createNode(this,config);
        this.sensor_id = config.sensor_id;
        //this.dataName0 = config.dataName0;
        //this.unitType0 = config.unitType0;
        //this.dataName1 = config.dataName1;
        //this.unitType1 = config.unitType1;

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
    RED.nodes.registerType("Core_Staff_Sensor",Core_Staff_Sensor);
}