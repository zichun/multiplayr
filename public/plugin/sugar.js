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
                    if (data.type === type) {
                        cb.call(playerObj, data.from, data.message);
                    }
                });
            };
        }

        self.defineHost(function (hostRule) {
            addOnMessageMethod(hostRule);

            hostRule.methods.sendMessage = function(clientId, type, message, cb) {
                var hostObj = this;
                hostObj.send(clientId,
                             {
                                 type: type,
                                 message: message
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

                clientObj.sendToHost({
                    type: type,
                    message: message
                }, cb);
            };

            clientRule.onMessage('client-set-view', function(from, message) {
                var playerObj = this;
                playerObj.setView(message.view, message.data);
            });
        });
    };
}
