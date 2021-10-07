
var HmiSchneiderWebSocket = require('./HMI-Schneider-Websocket');

const max_var_per_socket = 100;
const max_socket_per_hmi = 5;

//  Communication engine implement class
module.exports = HmiSchneiderComEngine;

function HmiSchneiderComEngine(url, maxSocket) {
  let self = this;

  this._url = url;
  this._maxSocket = max_socket_per_hmi;
  if (maxSocket && (maxSocket > 0) && (maxSocket <= max_socket_per_hmi)) {
    this._maxSocket = maxSocket;
  }
  this._wsList = [];
  this._objects = [];

  addNewWebSocket.call(self);
}

HmiSchneiderComEngine.prototype.dispose = function () {
  let self = this;
  while (this._wsList.length) {
    removeWebSocket.call(self, this._wsList.length - 1);
  }
}

HmiSchneiderComEngine.prototype.isconnected = function () {
  return (this._wsList.find(obj => obj.connected == false) == undefined);
}

HmiSchneiderComEngine.prototype.iserror = function () {
  return (this._wsList.find(obj => obj.error == false) == undefined);
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

  let addList = getMonitorVariables.call(self);
  let numSocket = Math.floor((addList.length + (max_var_per_socket - 1)) / max_var_per_socket);
  if (numSocket > this._wsList.length) {
    //  socket数が足りないので、追加。open時にモニタ変数の更新を行う
    while (numSocket > this._wsList.length) {
      addNewWebSocket.call(self);
    }
  } else {
    // モニタ変数の更新
    startMonitor.call(self);
  }
}

HmiSchneiderComEngine.prototype.delLinkData = function (nodeId) {
  let self = this;
  let len = this._objects.length;
  this._objects = this._objects.filter(obj => obj.nodeId != nodeId);
  if (len != this._objects.length) {
    // モニタ変数の更新
    startMonitor.call(self);
  }
}

function getMonitorVariables() {
  let list = [];
  this._objects.filter(obj => obj.kind == "variable").forEach(obj => { Array.prototype.push.apply(list, obj.Items); });
  list = Array.from(new Set(list));
  let max = max_var_per_socket * this._maxSocket;
  if (list.length > max) {
    return list.slice(0, max);
  }
  return list;
}

function addNewWebSocket() {
  let id = this._wsList.length;

  let obj = { connected: false, error: false };

  obj.ws = new HmiSchneiderWebSocket(id, (id == 0), false);
  obj.ws.onopen = onOpen.bind(this);
  obj.ws.onclose = onClose.bind(this);
  obj.ws.onerror = onError.bind(this);
  obj.ws.onmessage = onMessage.bind(this);

  this._wsList.push(obj);

  obj.ws.open(this._url, undefined);
}

function removeWebSocket(pos) {
  if (this._wsList.length <= pos) { return; }

  let obj = this._wsList[pos];
  this._wsList.splice(pos, 1);

  obj.connected = false;
  obj.ws.dispose();
}


function startMonitor() {
  let self = this;

  this._wsList.filter(obj => obj.connected).forEach(obj => { obj.ws.send_clear_monitor(); });

  //  繋がっていない場合は待つ
  if (!this.isconnected()) { return; }

  let addList = getMonitorVariables.call(self);

  let pos = 0;
  while (addList.length) {
    let numInSocket = (addList.length >= max_var_per_socket) ? max_var_per_socket : addList.length;
    let list = addList.splice(0, numInSocket);

    this._wsList[pos].ws.send_add_monitor(list);
    pos++;
  }

  //  不要なソケットを解放する
  if (pos == 0) { pos++; }
  while (this._wsList.length > pos) {
    removeWebSocket.call(self, pos);
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

function onOpen(id) {
  if (this._wsList.length <= id) { return; }

  let self = this;
  this._wsList[id].connected = true;
  this._wsList[id].error = false; //  clear error
  if (this.isconnected()) {
    startMonitor.call(self);
    statusUpdate.call(self);
  }
}

function onClose(id) {
  if (this._wsList.length <= id) { return; }

  let self = this;
  let connected = this.isconnected();
  this._wsList[id].connected = false;

  if (connected && !this.isconnected()) {
    statusUpdate.call(self);
  }
}

function onError(id) {
  if (this._wsList.length <= id) { return; }

  let self = this;
  let error = this.iserror();
  this._wsList[id].connected = false;
  this._wsList[id].error = true;

  if (!error && this.iserror()) {
    statusUpdate.call(self);
  }
}

function onMessage(id, jsonObj) {
  if (this._wsList.length <= id) { return; }

  let self = this;
  let updated = jsonObj.updated;
  if (updated == "variable") {
    variableUpdate.call(self, jsonObj.data);
  } else if ((id == 0) && (updated == "alarm")) {
    alarmUpdate.call(self, jsonObj.data);
  } else if ((id == 0) && (updated == "error")) {
  }
}
