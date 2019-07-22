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

    function hmiSchneiderCom(config) {
        RED.nodes.createNode(this, config);

        const HmiSchneiderWebSocket = require('./HMI-Schneider-WebSocket.js');

        this.host = config.etherAdd;
        this.port = config.etherPort;

        this.subscription = false;
        this.ws = null;

        this.linkObjs = [];
        this.flagRecon = false;
        this.flagOpened = false;

        this.startmonitor = function(){
            if ((this.ws != null) && (this.flagOpened == true)) {
                this.ws.send_clear_monitor();

                let addList = [];
                this.linkObjs.forEach(function (linkObj, idx) {
                    if ((linkObj != null) && (linkObj.kind == "variable")){
                        linkObj.Items.forEach(function (variable, idx) {
                            addList.push(variable);
                        });
                    }
                });
                this.ws.send_add_monitor(addList);
                
                if (this.flagRecon) {
                    // 通信フレーム情報の再構成フラグをoff
                    this.flagRecon = false;
                }
            }
        };

        this.ws = new HmiSchneiderWebSocket();

		this.ws.onopen = function() {
            this.flagOpened = true;
            this.subscription = false;
            this.startmonitor();
            this.statusUpdate(true);
        }.bind(this);

		this.ws.onclose = function() {
            if (this.flagOpened == true)
                this.statusUpdate(false);
            this.flagOpened = false;
        }.bind(this);
        
		this.ws.onmessage = function(jsonObj) {
            if (this.subscription == false) {
                this.subscription = true;
            }
            
            let updated = jsonObj.updated;
            if (updated == "variable") {
                this.variableUpdate(jsonObj.data);
            }
            else if (updated == "alarm") {
                this.alarmUpdate(jsonObj.data);
            }
            else if (updated == "error") {
            }
        }.bind(this);

        this.ws.open("ws://"+this.host+":"+this.port+"/api/v1/ws", undefined);


        this.variableUpdate = function(variables){
            this.linkObjs.forEach(function (linkObj, idx) {
                if ((linkObj != null) && (linkObj.kind == "variable")){
                    let hmiNode = RED.nodes.getNode(linkObj.nodeId);
                    if (hmiNode)
                        hmiNode.emit("valueUpdated", variables);
                }
            });
        };

        this.alarmUpdate = function(alarms){
            this.linkObjs.forEach(function (linkObj, idx) {
                if ((linkObj != null) && (linkObj.kind == "alarm")){
                    let hmiNode = RED.nodes.getNode(linkObj.nodeId);
                    if (hmiNode)
                        hmiNode.emit("alarmUpdated", alarms);
                }
            });
        };

        this.statusUpdate = function(connected){
            this.linkObjs.forEach(function (linkObj, idx) {
                if (linkObj != null){
                    let hmiNode = RED.nodes.getNode(linkObj.nodeId);
                    if (hmiNode)
                        hmiNode.emit("statusChanged", connected);
                }
            });
        };

        this.toHex = function(v) {
            return '0x' + (('0000' + v.toString(16).toUpperCase()).substr(-4));
        };

        this.on("input",function(msg) {

        });

        this.on("close",function() {
            if (this.ws != null) {
                this.ws.close();
            }
        });

        this.on("addLinkData",function(lObj) {
            //console.log("node.onのaddLinkDataが呼ばれた");
            // linkObjに新たなリンクデータを追加
            let found = false;
            for (let i=0; i<this.linkObjs.length; i++){
                if ((this.linkObjs[i] != null) && (this.linkObjs[i].nodeId == lObj.nodeId)) {
                    this.linkObjs[i] = lObj;
                    found = true;
                    break;
                }
            }
            
            if (found == false) {
                for (let i=0; i<this.linkObjs.length; i++){
                    if (this.linkObjs[i] == null) {
                        this.linkObjs[i] = lObj;
                        found = true;
                        break;
                    }
                }
            }

            if (found == false) {
                this.linkObjs.push(lObj);
            }
            // linkObjが変更されたので、通信フレーム情報の再構築フラグをon
            this.flagRecon = true;

            this.startmonitor();
        });

        this.on("delLinkData",function(nodeId) {
            //console.log("node.onのdelLinkDataが呼ばれた");
            if ((this.linkObjs[i] != null) && (this.linkObjs[i].nodeId == nodeId)) {
                this.linkObjs[i] = null;
                break;
            }

            // linkObjが変更されたので、通信フレーム情報の再構築フラグをon
            this.flagRecon = true;

            this.startmonitor();
        });
    }

    RED.nodes.registerType("HMI-Schneider-com",hmiSchneiderCom);

}
