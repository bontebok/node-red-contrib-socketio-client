
module.exports = function(RED) {
  'use strict';
  const { io } = require("socket.io-client");
  let path = require('path');
  let customProperties = {};
  let sockets = {};

  /* sckt config */
  function SocketIOConfig(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.host = n.host;
    this.port = n.port;
    this.path = n.path;
    this.options = (n.path) ? { path: n.path} : {};

    if(sockets[node.id]){ delete sockets[node.id];}

    sockets[node.id] = io(node.host, node.options);

    node.on("close", () => {
      sockets[node.id].disconnect();
      delete sockets[node.id];
    })

  }

  /* sckt connector*/
/*
  function SocketIOConnector(n) {
    RED.nodes.createNode(this, n);
    this.server = RED.nodes.getNode(n.server);
    this.server.namespace = n.namespace;
    this.name = n.name;
    this.sockets = sockets;
    let node = this;

    sockets[node.name] = connect(this.server);

    sockets[node.name].on('connect', () => {
      node.send({ payload: { socketId: node.name, status: 'connected' } });
      node.status({ fill: "green", shape: "dot", text: "connected" });
    });

    sockets[node.name].on('disconnect', () => {
      node.send({ payload: { socketId: node.name, status: 'disconnected' } });
      node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
    });

    sockets[node.name].on('connect_error', (err) => {
      if (err) {
        node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
        node.send({ payload: { socketId: node.name, status: 'disconnected' } });
        //node.error(err);
      }
    });

    this.on('close', (removed, done) => {
      sockets[node.name].disconnect();
      node.status({});
      if (removed) {
        delete sockets[node.name];
      }
      done();
    });
  }
*/

function SocketIOEvents(n) {
  RED.nodes.createNode(this, n);
  var node = this;
  this.server = RED.nodes.getNode(n.server);

  this.managerEvents = [
    "open", "error", "close", "ping", "reconnect_attempt", // "packet"
    "reconnect", "reconnect_error", "reconnect_failed"
  ];

  this.socketEvents = [
    "connect", "connect_error", "disconnect"
  ];

  sockets[n.server].on("disconnect", () => {
    node.status({ fill: 'red', shape: 'dot', text: 'disconnected' });
  });

  sockets[n.server].on('connect_error', (err) => {
    if (err) {
      node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
    }
  });

  sockets[n.server].on("connect", () => {
    node.status({ fill: 'green', shape: 'dot', text: 'connected' });
  });

  node.managerEvents.forEach(function(val, i) {
    node.log("Manager Events");
    addListener(node, sockets[n.server].io, val, i);
  });

  node.socketEvents.forEach(function(val, i) {
    node.log("Socket Events");
    addListener(node, sockets[n.server], val, i);
  });
}

  /* sckt listener*/
  function SocketIOListener(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.eventName = n.eventname;
    //this.socketId = null;
    this.server = RED.nodes.getNode(n.server);
    this.rules = n.rules || [];

    sockets[n.server].on("disconnect", () => {
      node.status({ fill: 'red', shape: 'dot', text: 'disconnected' });
    });

    sockets[n.server].on('connect_error', (err) => {
      if (err) {
        node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
      }
    });

    sockets[n.server].on("connect", () => {
      node.status({ fill: 'green', shape: 'dot', text: 'connected' });
    });

    node.rules.forEach( (val,i) => {
      addListener(node, sockets[n.server], val.v, i);
    });

/*
    node.on('input', (msg) => {
      node.socketId = msg.payload.socketId;
      if (msg.payload.status == 'connected') {
        node.status({ fill: 'green', shape: 'dot', text: 'listening' });
        if (!sockets[node.socketId].hasListeners(node.eventName)) {
          sockets[node.socketId].on(node.eventName, function (data) {
            node.send({ payload: data });
          });
        }
      } else {
        node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
        if (sockets[node.socketId].hasListeners(node.eventName)) {
          sockets[node.socketId].removeListener(node.eventName, function () { });
        }
      }
    });

    node.on('close', (done) => {
      if (sockets[node.socketId].hasListeners(node.eventName)) {
        sockets[node.socketId].removeListener(node.eventName);
      }
      node.status({});
      done();
    });
  */
  }


  function SocketIOEmitter(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);
    var socket = sockets[n.server];

    node.on("input", function(msg) {
      this.payload = (msg.payload instanceof Array) ? msg.payload : [msg.payload];
      if (n.callback) {
        this.payload.push((callback) => {
          RED.util.setMessageProperty(msg, "payload", callback, true)
          node.send(msg);
        })
      }

      if(sockets[n.server])
        socket.emit(msg.socketIOEvent, ...this.payload);
      });
    }

  function connect(node, config, force) {
    var uri = config.host;
    var options = {
      reconnection: config.reconnection
    };

    if (config.port != '') {
      uri += ':' + config.port;
    }
    if (config.path != '') {
      options.path = config.path;
    }
    if (config.namespace) {
      uri = path.join(uri, config.namespace);
    }
    node.log("test");
    node.log(uri);
    node.log(options);
    return io(uri, options);
  }

  function disconnect(config) {
  }

  function addListener(node, socket, val, i) {
    socket.on(val, function(...msgin) {
      var msg = {};
      if ((msgin.length > 0) && (typeof(msgin[msgin.length - 1]) === 'function')) {
        let msginnew = msgin.slice(0,-1);
        RED.util.setMessageProperty(msg, "callback", msgin[msgin.length - 1], true);
        RED.util.setMessageProperty(msg, "payload", (msginnew.length == 1) ? msginnew[0] : msginnew, true);
      }
      else
        RED.util.setMessageProperty(msg, "payload", (msgin.length == 1) ? msgin[0] : msgin, true);

      RED.util.setMessageProperty(msg, "socketIOEvent", val, true);
      RED.util.setMessageProperty(msg, "socketIOId", socket.id, true);
      if (
        customProperties[RED.util.getMessageProperty(msg, "socketIOId")] !=
        null
      ) {
        RED.util.setMessageProperty(
          msg,
          "socketIOStaticProperties",
          customProperties[RED.util.getMessageProperty(msg, "socketIOId")],
          true
        );
      }
      node.send(msg);
    });
  }

  RED.nodes.registerType('socketio-client-config', SocketIOConfig);
  RED.nodes.registerType('socketio-client-events', SocketIOEvents);
  //RED.nodes.registerType('socketioc-connector', SocketIOConnector);
  RED.nodes.registerType('socketio-client-listener', SocketIOListener);
  RED.nodes.registerType('socketio-client-emitter', SocketIOEmitter);
  RED.nodes.registerType('socketio-client-callback', SocketIOEmitter);
}
