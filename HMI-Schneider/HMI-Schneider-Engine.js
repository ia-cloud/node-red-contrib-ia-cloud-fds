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

var moment = require("moment");

//  HMI-Schneider node implement class
module.exports = HmiSchneiderEngine;

function HmiSchneiderEngine(RED, owner, com, isvariable) {
    this._RED = RED;
    this._owner = owner;
    this._com = com.getEngine();
    this._com_state = "init"
    this._isvariable = isvariable;

    this._objects = [];

    this.NodeStatus = {
        Preparing: { fill: "blue", shape: "ring", text: "runtime.preparing" },
        Disconnected: { fill: "red", shape: "dot", text: "runtime.disconnected" },
        Connected: { fill: "green", shape: "dot", text: "runtime.connected" },
        Sent: { fill: "green", shape: "dot", text: "runtime.sent" },
    }

    this._timerid = setInterval(intervalFunc.bind(this), 1000, this);
}

HmiSchneiderEngine.prototype.dispose = function () {
    clearInterval(this._timerid);
    this._com.delLinkData(this._owner.id);
    this._com = null;
    this._objects = [];
}

HmiSchneiderEngine.prototype.isconnected = function () {
    if (this._com) {
        return this._com.isconnected();
    }
    return false;
}

HmiSchneiderEngine.prototype.getNodeState = function () {
    return this.isconnected() ? this.NodeStatus.Connected : this.NodeStatus.Disconnected;
}

HmiSchneiderEngine.prototype.addObjects = function (objects) {
    let self = this;
    objects.forEach(function (obj) { addObject_imp.call(self, obj); }, self);
    addLink.call(self);
}

HmiSchneiderEngine.prototype.addObject = function (obj) {
    let self = this;
    addObject_imp.call(self, obj);
    addLink.call(self);
}

HmiSchneiderEngine.prototype.replaceObjects = function (objects) {
    this._objects = [];
    this.addObjects(objects);
}

HmiSchneiderEngine.prototype.deleteObjects = function () {
    this._com.delLinkData(this._owner.id);
}

HmiSchneiderEngine.prototype.outputMsgs = function (msg) {
    let self = this;

    if (!this.isconnected()) {
        this._owner.error("HMI is not connected.", msg);
        return;
    }

    this._objects.forEach(function (obj) {
        if (this._isvariable) {
            sendVarMessages.call(self, obj, false);
        } else {
            sendAlarmMessages.call(self, obj, false);
        }
    }, this);
}

HmiSchneiderEngine.prototype.valueUpdated = function (variables) {
    if (!this._isvariable) {
        return;
    }

    this._objects.forEach(function (obj) {
        let updated = false;
        obj.objectContent.contentData.forEach(function (dataItem) {
            for (let i = 0; i < variables.length; i++) {
                if (dataItem.varName == variables[i].name) {
                    switch (variables[i].quality) {
                        case "good":
                            dataItem.quality = "good";
                            dataItem.value = variables[i].value;
                            break;
                        case "invalid":
                        case "bad":
                            dataItem.quality = "com. error";
                            break;
                        case "unknown":
                            dataItem.quality = "not updated";
                            break;
                    }
                    updated = true;
                    break;
                }
            }
        });
        if (updated) {
            //  最後にObjectのQualityをgoodに変更する
            obj.quality = "good";
        }
    });
}

HmiSchneiderEngine.prototype.alarmUpdated = function (alarms) {
    if (this._isvariable) {
        return;
    }

    this._objects.forEach(function (obj) {
        obj.objectContent.contentData.forEach(function (dataItem, index) {
            for (let i = 0; i < alarms.length; i++) {
                if (dataItem.varName == alarms[i].variable) {
                    dataItem.status = (alarms[i].status == "Return") ? null : alarms[i].type;
                    dataItem.message = alarms[i].message;
                    break;
                }
            }
        });
    });
}

HmiSchneiderEngine.prototype.statusChanged = function () {
    let self = this;
    if (this.isconnected()) {
        this._com_state = "connected";

        //  再接続時にAlarmは通知がこないので、ここでqualityを更新しておく
        //  Variableは変化通知が届くので、その時に行う
        if (!this._isvariable) {
            this._objects.forEach(function (obj) {
                obj.quality = "good";
            });
        }
    }
    else {
        //  HMIの接続が切れた場合はエラーとする
        if (this._com_state != "disconnected") {
            this._owner.error("HMI is not connected");
            this._com_state = "disconnected"
        }

        //  qualityをerrorにする
        this._objects.forEach(function (obj) {
            obj.quality = "com. error";
            if (self._isvariable) {
                //  variableはitemのqualityも全てエラーにする
                obj.objectContent.contentData.forEach(item => {
                    item.quality = "com. error";
                });
            }
        });
    }
    this._RED.nodes.getNode(this._owner.id).emit("statusChanged");
}

function addObject_imp(_obj) {
    let obj = Object.assign({}, _obj)
    obj.objectContent = Object.assign({}, _obj.objectContent);
    obj.objectContent.contentData = [];
    _obj.objectContent.contentData.forEach(item => { obj.objectContent.contentData.push(Object.assign({}, item)); });

    obj.lastIntervalCheck = null;
    obj.lastValueChangedCheck = null;
    obj.quality = "not updated";
    obj.prev_quality = obj.quality;

    obj.objectContent.contentData.forEach(item => {
        if (this._isvariable) {
            item.value = null;
            item.quality = "not updated";
            item.prev_quality = item.quality;
        } else {    //  alarm
            item.status = null;
            item.message = "";
        }
        item.prev = null;
    });

    this._objects.push(obj);
}

function addLink() {
    let linkObj = { Items: [] };
    linkObj.nodeId = this._owner.id;
    linkObj.cb = this;
    linkObj.kind = this._isvariable ? "variable" : "alarm";

    if (this._isvariable) {
        let items = [];
        this._objects.forEach(function (obj) {
            obj.objectContent.contentData.forEach(function (dataItem) {
                items.push(dataItem.varName);
            });
        });
        linkObj.Items = Array.from(new Set(items));
    }

    this._com.addLinkData(linkObj);
}

function intervalFunc() {
    let self = this;
    if (this._isvariable) {
        intervalFuncVar.call(self);
    }
    else {
        intervalFuncAlarm.call(self);
    }
}

function intervalFuncVar() {
    let self = this;
    let current = Date.now();

    self._objects.forEach(function (obj) {  //  check interval
        if (obj.storeInterval > 0) {
            if ((obj.lastIntervalCheck == null) || (current - (obj.lastIntervalCheck) >= (obj.storeInterval * 1000))) {
                if (obj.quality != "not updated") {   // 接続結果待ちは除外
                    sendVarMessages.call(self, obj, (obj.lastIntervalCheck == null)); //  初回だけ変化通知のフラグをONする
                }
                obj.lastIntervalCheck = current;
            }
        }
    }, self);

    self._objects.forEach(function (obj) {  //  check async
        if (obj.asyncInterval > 0) {
            if ((obj.lastValueChangedCheck == null) || (current - (obj.lastValueChangedCheck) >= (obj.asyncInterval * 1000))) {
                obj.lastValueChangedCheck = current;
                if ((obj.quality == obj.prev_quality) && !haveVarsUpdated.call(self, obj.objectContent.contentData)) {
                    return;
                }
                sendVarMessages.call(self, obj, true);
            }
        }
    }, self);
}

function haveVarsUpdated(items) {
    return (items.find(item => ((item.value != item.prev) || (item.quality != item.prev_quality))) != undefined) ? true : false;
}

function sendVarMessages(obj, valuechanged) {
    let msg = createMsg(obj, true);
    if (valuechanged) { //  update previous value when value changed trigger
        obj.objectContent.contentData.forEach(item => { item.prev = item.value; item.prev_quality = item.quality; });
        obj.prev_quality = obj.quality;
    }

    this._RED.nodes.getNode(this._owner.id).emit("outputMsg", msg);

    return true;
}

function intervalFuncAlarm() {
    let self = this;
    let current = Date.now();

    self._objects.forEach(function (obj) { //  check interval
        if (obj.storeInterval > 0) {
            if ((obj.lastIntervalCheck == null) || (current - (obj.lastIntervalCheck) >= (obj.storeInterval * 1000))) {
                if (obj.quality != "not updated") {   // 接続結果待ちは除外
                    sendAlarmMessages.call(self, obj, (obj.lastIntervalCheck == null)); //  初回だけ変化通知のフラグをONする
                }
                obj.lastIntervalCheck = current;
            }
        }
    }, self);

    self._objects.forEach(function (obj) { //  check async
        if (obj.asyncInterval > 0) {
            if ((obj.lastValueChangedCheck == null) || (current - (obj.lastValueChangedCheck) >= (obj.asyncInterval * 1000))) {
                obj.lastValueChangedCheck = current;
                if ((obj.quality == obj.prev_quality) && !haveAlarmsUpdated.call(self, obj.objectContent.contentData)) {
                    return;
                }
                sendAlarmMessages.call(self, obj, true);
            }
        }
    }, self);
}

function haveAlarmsUpdated(items) {
    return (items.find(item => item.status != item.prev) != undefined) ? true : false;
};

function sendAlarmMessages(obj, valuechanged) {
    let msg = createMsg(obj, false);
    if (valuechanged) { //  update previous value when value changed trigger
        obj.objectContent.contentData.forEach(item => { item.prev = item.status; });
        obj.prev_quality = obj.quality;
    }

    this._RED.nodes.getNode(this._owner.id).emit("outputMsg", msg);

    return true;
}

function createMsg(obj, isvariable) {
    let msg = { request: "store", dataObject: { objectContent: {} } };

    msg.dataObject.objectKey = obj.objectKey;
    msg.dataObject.timestamp = moment().format();
    msg.dataObject.objectType = "iaCloudObject";
    msg.dataObject.objectDescription = obj.objectDescription;
    msg.dataObject.objectContent.contentType = obj.objectContent.contentType;
    msg.dataObject.quality = obj.quality;

    let contentData = createContendData(obj, isvariable);
    msg.dataObject.objectContent.contentData = contentData;
    msg.payload = contentData;

    return msg;
}

function createContendData(obj, isvariable) {
    let contentData = [];
    obj.objectContent.contentData.forEach(function (item) {
        let dItem = {};
        if (isvariable) {
            dItem.dataName = item.dataName;
            dItem.dataValue = item.value;
            dItem.quality = item.quality;
            if (item.unit && (item.unit != "")) {
                dItem.unit = item.unit;
            }
        }
        else {
            dItem.commonName = "Alarm&Event";
            dItem.dataValue = {};
            if (item.status == null) {
                dItem.dataValue.AnEStatus = (item.status == item.prev) ? "off" : "reset";
            } else {
                dItem.dataValue.AnEStatus = (item.status == item.prev) ? "on" : "set";
            }
            dItem.dataValue.AnECode = item.code;
            if (!dItem.dataValue.AnECode) { dItem.dataValue.AnECode = item.varName; }
            dItem.dataValue.AnEDescription = item.description;
            if (!dItem.dataValue.AnEDescription) { dItem.dataValue.AnEDescription = item.message; }
        }
        contentData.push(dItem);
    });

    return contentData;
}
