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

//  definition of disconnect sec in idle.
//  HMI will send ping every 10sec if there are any communication.
//  And if HMI do not receive pong from client, disconnet session in 60sec.
//  From the specification, if HMI is connected, websocket client should receive ping in every 10 sec.
const websocket_disconnect_sec = 30;

/* Pro-face BLUE/Schneider Electric EcoStruxure Operator Terminal Expart WebSocket class */
module.exports = class HmiSchneiderWebSocket {
  constructor(id, alarm, error) {
    this._id = id;
    this._alarm = alarm;
    this._error = error;
    this._url = "";
    this._token = "";
    this._ws = null;
    this.en_status = { en_none: 0, en_opened: 1, en_authenticated: 2, en_operational: 3 };
    this._status = this.en_status.en_none;
    this._timer_id = null;
    this._reconnect_id = null;
    this._last_received = null;
    this._cb_onopen = null;
    this._cb_onmessage = null;
    this._cb_onclose = null;
    this._cb_onerror = null;

    this._disposed = false;
  }

  dispose() {
    this._disposed = true;
    this.close();
  }

  get status() {
    return this._status;
  }

  set onopen(func) {
    this._cb_onopen = func;
  }

  set onmessage(func) {
    this._cb_onmessage = func;
  }

  set onclose(func) {
    this._cb_onclose = func;
  }

  set onerror(func) {
    this._cb_onerror = func;
  }

  open(url, token) {
    if (this._disposed) {
      return;
    }

    var WebSocket = require('ws');

    if (!this._ws) {
      if (url != undefined) {
        this._url = url;
      }
      if (token != undefined) {
        this._token = token;
      }

      // init WebSocket
      this._status = this.en_status.en_none;
      this._ws = new WebSocket(this._url);
      // event handler
      this._ws.onopen = this.onOpen.bind(this);
      this._ws.onmessage = this.onMessage.bind(this);
      this._ws.onclose = this.onClose.bind(this);
      this._ws.onerror = this.onError.bind(this);
      this._ws.on('ping', this.onPing.bind(this));
    }
  }

  close() {
    if (this._ws) {
      this._ws.close();
    }

    this._ws = null;
    this._status = this.en_status.en_none;
  }

  onOpen() {
    if (this._reconnect_id) {
      clearTimeout(this._reconnect_id);
      this._reconnect_id = null;
    }
    this._status = this.en_status.en_opened;
    this.update_received_date();
    this._timer_id = setTimeout(this.check_connection.bind(this), 1000);
    this.send_authorization();
  }

  onMessage(event) {
    this.update_received_date();
    if (event && event.data) {
      if (this._status == this.en_status.en_authenticated) {
        this.send_subscriptions();
      }
      else if (this._status == this.en_status.en_operational) {
        var jsonObj = JSON.parse(event.data);
        this.get_subscription(jsonObj);
      }
    }
  }

  onError() {
    if (this._cb_onerror) {
      this._cb_onerror.call(this, this._id);
    }

    this.close();
  }

  onClose() {
    this._ws = null;

    this._status = this.en_status.en_none;
    if (this._timer_id) {
      clearTimeout(this._timer_id);
      this._timer_id = null;
    }

    if (this._reconnect_id) {
      clearTimeout(this._reconnect_id);
      this._reconnect_id = null;
    }
    if (!this._disposed) {
      this._reconnect_id = setTimeout(this.open.bind(this), 5000);
    }

    if (this._cb_onclose) {
      this._cb_onclose.call(this, this._id);
    }
  }

  onPing(data) {
    this.update_received_date();
  }

  send_authorization() {
    //this._ws.send(JSON.stringify({Authorization:"Bearer " + this._token}));
    //this._status = this.en_status.en_authenticated;
    this.send_subscribe();
  }

  send_add_monitor(src) {
    this.send_monitor_command("add_monitor", src);
  }

  send_replace_monitor(src) {
    this.send_monitor_command("replace_monitor", src);
  }

  send_remove_monitor(src) {
    this.send_monitor_command("remove_monitor", src);
  }

  send_clear_monitor() {
    this.send_monitor_command("clear_monitor", null);
  }

  send_monitor_command(command_name, src) {
    var command = {};
    command.command = command_name;
    if (src) {
      command.variable = src ? src.concat() : [];
    }

    this._ws.send(JSON.stringify(command));
  }

  send_subscribe() {
    let alarm = [];
    if (this._alarm) { alarm.push("alarm"); }
    if (this._error) { alarm.push("error"); }
    if (alarm.length > 0) {
      this._ws.send(JSON.stringify({ command: "subscribe", alarm: alarm }));
    }

    this._status = this.en_status.en_operational;
    if (this._cb_onopen) {
      this._cb_onopen.call(this, this._id);
    }
  }

  get_subscription(jsonObj) {
    if (this._cb_onmessage) {
      this._cb_onmessage.call(this, this._id, jsonObj);
    }
  }

  update_received_date() {
    this._last_received = Date.now();
  }

  check_connection() {
    this._timer_id = null;
    if (this._ws) {
      if ((Date.now() - this._last_received) > (websocket_disconnect_sec * 1000)) {
        this.close();
      }
      else {
        this._timer_id = setTimeout(this.check_connection.bind(this), 1000);
      }
    }
  }
}
