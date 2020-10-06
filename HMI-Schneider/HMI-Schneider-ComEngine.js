
var HmiSchneiderWebSocket = require('./HMI-Schneider-Websocket');

//  Communication engine implement class
module.exports = HmiSchneiderComEngine;

function HmiSchneiderComEngine(url) {
    this._url = url;

    this._ws = new HmiSchneiderWebSocket();

    this._objects = [];
    this.Connected = false;

    this._ws.onopen = onOpen.bind(this);
    this._ws.onclose = onClose.bind(this);
    this._ws.onmessage = onMessage.bind(this);

    this._ws.open(this._url, undefined);
}

HmiSchneiderComEngine.prototype.dispose = function () {
    if (this._ws) {
        this.Connected = false;
        this._ws.dispose();
    }
}

HmiSchneiderComEngine.prototype.isconnected = function () {
    return this.Connected;
}

HmiSchneiderComEngine.prototype.addLinkData = function (obj) {
    let self = this;
    let found = false;
    for (let i = 0; i < this._objects.length; i++) {
        if (this._objects[i] && (this._objects[i].nodeId == obj.nodeId)) {
            this._objects[i] = obj;
            found = true;
            break;
        }
    }

    if (!found) {
        this._objects.push(obj);
    }
    // モニタ変数の更新
    startMonitor.call(self);
}

HmiSchneiderComEngine.prototype.delLinkData = function (nodeId) {
    let self = this;
    let len = this._objects.length;
    this._objects = this._objects.filter(obj => obj.nodeId != nodeId);
    if (len != this._objects.length) {
        // モニタ変数の更新
        this.startmonitor.call(self);
    }
}

function startMonitor() {
    if (this._ws && (this.Connected)) {
        this._ws.send_clear_monitor();

        let addList = [];
        this._objects.filter(obj => obj.kind == "variable").forEach(obj => { Array.prototype.push.apply(addList, obj.Items); });
        this._ws.send_add_monitor(Array.from(new Set(addList)));
    }
}

function statusUpdate() {
    this._objects.filter(obj => obj.cb).forEach(obj => { obj.cb.statusChanged(); });
};

function variableUpdate(variables) {
    this._objects.filter(obj => obj.kind == "variable" && obj.cb).forEach(obj => { obj.cb.valueUpdated(variables); });
};

function alarmUpdate(alarms) {
    this._objects.filter(obj => obj.kind == "alarm" && obj.cb).forEach(obj => { obj.cb.alarmUpdated(alarms); });
};

function onOpen() {
    let self = this;
    self.Connected = true;
    startMonitor.call(self);
    statusUpdate.call(self);
}

function onClose() {
    let self = this;
    if (self.Connected) {
        self.Connected = false;
        statusUpdate.call(self);
    }
}

function onMessage(jsonObj) {
    let self = this;
    let updated = jsonObj.updated;
    if (updated == "variable") {
        variableUpdate.call(self, jsonObj.data);
    } else if (updated == "alarm") {
        alarmUpdate.call(self, jsonObj.data);
    } else if (updated == "error") {
    }
}
