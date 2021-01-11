
module.exports = function(RED) {
    "use strict";

    function renameData(config) {

        RED.nodes.createNode(this,config);
        const node = this;
        const objFilter = config.objFilter;
        const dItemFilter = config.dItemFilter;

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
                return rule.objKey === msg.dataObject.objectKey || rule.objKey === "";
            });
            if (!rulesOn.length && objFilter) return;

            if (msg.dataObject.ObjectContent) {
                msg.dataObject.objectContent = msg.dataObject.ObjectContent;
                delete msg.dataObject.ObjectContent;
            };
            let dataItems = msg.dataObject.objectContent.contentData.concat();

            for (let rule of rulesOn) {

                for (let i = 0 ; i < dataItems.length ; i++) {
                    // dataName dose match rule's ?
                    if (dataItems[i].dataName === rule.orDataName) dataItems[i].dataName = rule.chDataName;
                    else if (dItemFilter) dataItems[i] = undefined;
                }
            }

            // delete undefined dataItem
            msg.dataObject.objectContent.contentData 
                = dataItems.filter(dataItem => { return dataItem;});
            msg.payload = msg.dataObject.objectContent.contentData;
            // output message to the port
            send(msg);
            node.status({fill:"green", shape:"dot", text:"runtime.output"});
        }); 
    }

    RED.nodes.registerType("rename-data",renameData);
}
