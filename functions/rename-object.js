
module.exports = function(RED) {
    "use strict";

    function renameObject(config) {

        RED.nodes.createNode(this,config);
        const node = this;
        const objFilter = config.objFilter;
        // Nodeのconfigパラメータから、rulesをコピー
        const rules = config.rules;
        // no rule found
        if (rules.length === 0)
            node.status({fill:"yellow", shape:"ring", text:"runtime.norule"});
        else
            node.status({fill:"green", shape:"dot", text:"runtime.ready"});

        // input message listener
        this.on("input",function(msg, send) {

            // msg.request msg,dataObject not exist,empty or no rule, do nothing
            if (rules.length === 0 || !msg.request === "store" || !msg.dataObject) return;

            let objectKey = msg.dataObject.objectKey;
            if (objFilter) msg.dataObject.objectKey = "";
            for (let rule of rules) {
                if (rule.orObjectKey === objectKey) {
                    msg.dataObject.objectKey = rule.chObjectKey;
                    break;
                }
            }
            // output message to the port
            if (msg.dataObject.objectKey) {
                send(msg);
                node.status({fill:"green", shape:"dot", text:"runtime.output"});
            }
        }); 
    }

    RED.nodes.registerType("rename-object",renameObject);
}
