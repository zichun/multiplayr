function Sugar(_opt) {
    return function() {
        var self = this;

        function addOnMessageMethod(playerRuleObj) {
            playerRuleObj.onMessage = function(type, cb) {
                playerRuleObj.on('message', function(data) {
                    var hostObj = this;
                    if (data.type === type) {
                        cb.call(hostObj, data.from, data.message);
                    }
                });
            };
        }

        self.defineHost(function (hostRule) {
            addOnMessageMethod(hostRule);

            hostRule.methods.sendMessage = function(to, type, message, cb) {
                var hostObj = this;
                hostObj.send(player,
                             {
                                 type: type,
                                 message: message
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
        });
    };
}
