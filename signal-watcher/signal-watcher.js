"use strict";

module.exports = function(RED) {

    function signalWatcher(config) {

        RED.nodes.createNode(this,config);

        let node = this;

        this.on("changeListener",function(objectKeys) {

        });

        this.on("input",function(msg) {

        });

        this.on("close",function() {

        });
    }

    RED.nodes.registerType("signal-watcher", signalWatcher);

}
