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


/* Pro-face BLUE/Schneider Electric EcoStruxure Operator Terminal Expart WebSocket class */
module.exports = class HmiSchneiderWebSocket {
    constructor() {
        this._url = "";
        this._token = "";
        this._ws = null;
        this.en_status = { en_none:0, en_opened:1, en_authenticated:2, en_operational:3};
        this._status = this.en_status.en_none;
        this._timer_id = null;
        this._last_received = null;
        this._cb_onopen = null;
        this._cb_onmessage = null;
        this._cb_onclose = null;
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
    
    open(url, token) {
        var WebSocket = require('websocket').w3cwebsocket;
        
        if (this._ws == null) {
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
        }
    }
    
    close () {
        if (this._ws != null) {
            this._ws.close();
        }
        
        this._ws = null;
        this._status = this.en_status.en_none;
    }
    
    onOpen(event) {
        this._status = this.en_status.en_opened;
        this.update_received_date();
        //this._timer_id = setTimeout(this.check_connection.bind(this), 10000);
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

    onError(event) {
        this.close();
    }
    
    onClose(event) {
        this._ws = null;
        this._status = this.en_status.en_none;
        if (this._timer_id != null) {
            clearTimeout(this._timer_id);
        }
        
        setTimeout(this.open.bind(this), 3000);
        
        if (this._cb_onclose != null) {
            this._cb_onclose.call(this);
        }
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
        
        if (src != null)
        {
            var variables = [];
            for (var i=0; i<src.length; i++) {
                variables.push(src[i]);
            }
            command.variable = variables;
        }
        
        this._ws.send(JSON.stringify(command));
    }
    
    send_subscribe() {
        this._ws.send(JSON.stringify({command:"subscribe",alarm:["alarm","error"]}));

        this._status = this.en_status.en_operational;
        if (this._cb_onopen != null) {
            this._cb_onopen.call(this);
        }
    }
    
    get_subscription(jsonObj) {
        if (this._cb_onmessage != null) {
            this._cb_onmessage.call(this, jsonObj);
        }
    }
    
    update_received_date() {
        this._last_received = Date.now();
    }
    
    /*
    check_connection() {
        this._timer_id = null;
        if (this._ws != null) {
            let now = Date.now();
            if (now - this._last_received > 100000) {
                this.close();
            }
            else {
                this._timer_id = setTimeout(this.check_connection.bind(this), 10000);
            }   
        }
    }
    */
}