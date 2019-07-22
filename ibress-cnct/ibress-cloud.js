"use strict";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
module.exports = function(RED) {
    const DHWebSocket = require('./DHWebSocket.js');

    function iBressCloudNode(n) {
        RED.nodes.createNode(this, n);
        this.host = n.host;
        this.port = n.port;
        this.usessl = n.usessl;
        this.user = this.credentials.user;
        this.password = this.credentials.password;
        // Verify if node is available
        var self = this;
        this.connect();
    }
    RED.nodes.registerType('iBRESS Cloud', iBressCloudNode, {
        credentials: {
            user: {type: "text"},
            password: {type:"password"}
        }
    });

    iBressCloudNode.prototype.connect = function() {
        this.emit('connecting');
        var Connection = new DHWebSocket();
        this.conn = Connection;
        var self = this, node = this;

        // Run this function when the connection is established.  This will be called after every re-connection if the
        // network is lost for any reason
        Connection.onConnectionSuccess = function (host, port)
        {
            self.emit('connected');
            node.log(RED._("ibress.status.connected", {host:host, port:port}));
            Connection.send("(domains)");
        }

        // Run this function when a connection is lost, or when an attempt to connect fails.
        Connection.onConnectionFailure = function (host, port)
        {
            //self.emit('disconnected');
            node.log(RED._("ibress.status.disconnected", {host:host, port:port}));
        }

        // Run this function when an attempt to connect fails.
        Connection.onConnectionError = function (host, port, e)
        {
            self.emit('error');
            node.error(RED._("ibress.errors.connect", {host:host, port:port, message:e.error}));
        }

        // Add a handler for asynchronous messages. This is called when any unprocessed message arrives.  For example, we can
        // use this to process domain names reported as a result of the (domains) command sent in the onConnectionSuccess function.
        Connection.handlers["AsyncMessage"] = function (args) {
            node.trace("Async message: " + args);
        }

        // Add a handler for error messages that we receive from the DataHub.
        Connection.handlers["error"] = function (args) {
            self.emit('error');
            node.error("error: " + args);
        }

        this.domains = {};
        this.registerDomains = {read:{}, write:{}};
        this.registerDomain = function(type, domain, param) { self.registerDomains[type][domain] = param || false; }
        // Add a handler for domain messages that we receive from the DataHub.
        Connection.handlers["domains"] = function (args) {
            for (var name in self.registerDomains.read) {
                !args.find( n => n === name) && node.log(RED._("ibress.errors.no-domain", {domain:name}));
                node.log(RED._("ibress.status.report-domain", {domain:name}));
                self.conn.registerDomain(name, self.registerDomains.read[name]);
                self.domains[name] = {};
            }
            for (var name in self.registerDomains.write) {
                if (self.registerDomains.write[name]) {
                    node.log(RED._("ibress.status.auth-domain", {domain:name}));
                    Connection.send('(domain ' + name + ')'), Connection.send('(set_authoritative ' + name + ' 1)');
                }
            }
        }

        // Add handlers for all points we are monitoring
        Connection.addPointHandler("*", function(args) {
            // 0:point 1:name 2:type 3:value [4:conf 5:security 6:locked 7:seconds 8:nanoseconds 9:flags 10:quality]
            var [domain, name] = args[1].split(':');
            var msg = {domain:domain, payload:{}, name:args[1], type:args[2], value:args[3], conf:args[4], security:args[5],
                        seconds:args[6], seconds:args[7], nanoseconds:args[8], flags:args[9], quality:args[10], Quality:Connection.qualities[args[10]]};
            msg.payload[name] = args[3];
            self.domains[domain][name] !== undefined && self.emit('read', msg);
            self.domains[domain][name] = msg;
        });

        // Handle the close event to disconnect when the node is stopped
        node.on('close', function(removed, done) {
            self.conn.disconnect();
            self.emit('disconnected');
            done();
        });

        Connection.connect(this.host, this.port, this.usessl);
        Connection.setAuth(this.user, this.password);
    }

    iBressCloudNode.prototype.disconnect = function(node) {
        this.conn.disconnect();
    }

    iBressCloudNode.prototype.write = function(domain, points) {
        Object.keys(points).forEach( name => this.conn.forceWrite(domain + ':' + name, points[name]) );
    }


    var state = {
        connecting: { fill:"yellow", shape:"dot", text:"node-red:common.status.connecting" },
        connected: { fill:"green", shape:"dot", text:"node-red:common.status.connected" },
        disconnected: { fill:"yellow", shape:"dot", text:"node-red:common.status.disconnected" },
        error: { fill:"red", shape:"ring", text:"node-red:common.status.error" },
        setup: function (o, node) {
            o.on('connecting', () => node.status(state.connecting) );
            o.on('connected', () => node.status(state.connected) );
            o.on('disconnected', () => node.status(state.disconnected) );
            o.on('error', () => node.status(state.error) );
        }
    };

    function iBressWriteNodeForIaDataObject(n) {
        RED.nodes.createNode(this, n);
        this.server = RED.nodes.getNode(n.server);
        var node = this;
        this.server.registerDomain('write', n.domain, true);
        state.setup(this.server, node);
        node.on('input', function(msg) {
            var kv = {};
            msg.dataObject.ObjectContent.contentData.forEach(o => {
                kv[o.commonName] = o.dataValue;
            })
            this.server.write(n.domain, kv);
            node.send(msg);
        });
    }
    RED.nodes.registerType("ibress-cnct", iBressWriteNodeForIaDataObject);

}
