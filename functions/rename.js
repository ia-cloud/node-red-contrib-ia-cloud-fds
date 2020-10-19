
module.exports = function(RED) {
    "use strict";

    function rename(config) {

        RED.nodes.createNode(this,config);
        const node = this;
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

            let rulesOn = rules.filter(rule => {
                return rule.orObjKey === msg.dataObject.objectKey || rule.orObjKey === "";
            });
            if (!rulesOn) return;
            
            let dataItems = msg.dataObject.objectContent.contentData.concat();

            for (let rule of rulesOn) {
                if (rule.orObjKey) msg.dataObject.objectKey = rule.chObjKey;
                if (!rule.orDataName) continue;

                for (let dataItem of dataItems) {
                    // dataName dose match rule's ?
                    if (dataItem.dataName === rule.orDataName)
                        dataItem.dataName = rule.chDataName;
                }
            }

            // output message to the port
            msg.dataObject.objectContent.contentData = dataItems;
            msg.payload = dataItems;
            send(msg);
            node.status({fill:"green", shape:"dot", text:"runtime.output"});
        }); 
    }

    RED.nodes.registerType("rename",rename);
}
