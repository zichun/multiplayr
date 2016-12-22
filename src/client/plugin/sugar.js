/***

This plugin adds several useful functionalities.

1. Typed Message

host and client player objects can send a message via sendMessage. Signature for host object is
   hostObj.sendMessage(clientId, type, data, [callback])
and the signature for client object is
   clientObj.sendMessage(type, data, [callback])  // the receipient is omitted because client can only talk to host

The host and client rules can listen to typed messages by registering a type with the onMessage method:
   hostRule.onMessage(type, callback)

2. Set Views

hostObjects can set the views of clients directly with the method
    hostObj.clientSetView(clientId, type, viewData, [callback])

This is achieved by sending a message with type 'client-set-view' to the client.

***/

function Sugar(_opt) {
    return function() {
        var self = this;

        function addOnMessageMethod(playerRuleObj) {
            playerRuleObj.onMessage = function(type, cb) {
                playerRuleObj.on('message', function(data) {
                    var playerObj = this;

                    if (typeof data === 'object' && data.type === type) {
                        var message = data.message.data;
                        var uniqid = data.message.uniqid;
                        var from = data.from;

                        var cbFn = function(d) {
                            if (playerObj.isHost) {
                                playerObj.sendMessage(data.from, 'typedmessage-ack', {
                                    uniqid: uniqid,
                                    data: d
                                });
                            } else {
                                playerObj.sendMessage('typedmessage-ack', {
                                    uniqid: uniqid,
                                    data: d
                                });
                            }
                        };

                        cb.call(
                            playerObj,
                            from,
                            message,
                            cbFn
                        );
                    }

                });
            };

            playerRuleObj.onMessage('typedmessage-ack', function(from, message) {
                var playerObj = this;
                var uniqid = message.uniqid;
                var data = message.data;

                if (typeof playerObj.typedMessage === 'object' && typeof playerObj.typedMessage[uniqid] !== 'undefined') {
                    playerObj.typedMessage[uniqid].call(playerObj, data);
                    delete(playerObj.typedMessage[uniqid]);
                }
            });
        }

        self.defineHost(function (hostRule) {
            addOnMessageMethod(hostRule);

            hostRule.methods.sendMessage = function(clientId, type, message, cb) {
                var hostObj = this;
                var uniqid = Math.random() + '' + Math.random();
                if (typeof hostObj.typedMessage === 'undefined') {
                    hostObj.typedMessage = {};
                }
                if (cb) hostObj.typedMessage[uniqid] = cb;
                hostObj.send(clientId,
                             {
                                 type: type,
                                 message: {
                                     data: message,
                                     uniqid: uniqid
                                 }
                             });
            };

            hostRule.methods.clientEmitView = function(client, type, data, cb) {
                var hostObj = this;
                hostObj.sendMessage(client, 'client-emit-view', {
                    type: type,
                    data: data
                }, cb);
            };

            hostRule.methods.clientSetView = function(client, view, data, cb) {
                var hostObj = this;
                hostObj.sendMessage(client, 'client-set-view', {
                    view: view,
                    data: data
                }, cb);
            };
        });

        self.defineClient(function(clientRule) {
            addOnMessageMethod(clientRule);

            // Client can only send message to host
            clientRule.methods.sendMessage = function(type, message, cb) {
                var clientObj = this;
                var uniqid = Math.random() + '' + Math.random();

                if (typeof clientObj.typedMessage === 'undefined') {
                    clientObj.typedMessage = {};
                }
                if (cb) clientObj.typedMessage[uniqid] = cb;

                clientObj.sendToHost({
                    type: type,
                    message: {
                        data: message,
                        uniqid: uniqid
                    }
                });
            };

            clientRule.onMessage('client-emit-view', function(from, message, fn) {
                var playerObj = this;
                playerObj.getView().emit(message.type, message.data);
                fn(message.type);
            });
            clientRule.onMessage('client-set-view', function(from, message, fn) {
                var playerObj = this;
                playerObj.setView(message.view, message.data);
                fn(message.view);
            });
        });
    };
}
