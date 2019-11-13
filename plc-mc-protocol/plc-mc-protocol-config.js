
module.exports = function (RED) {
    RED.nodes.registerType('PLC MC config', function (config) {
        RED.nodes.createNode(this, config);
        this.host = config.host;
        this.port = config.port;
    });
};
