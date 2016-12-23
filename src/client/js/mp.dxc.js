/**
 * Multiplayr is designed to be data-driven, and hence we only allow data exchange in this intermediate protocol layer
 * Data will only be stored in the host
 */

// todo: deprecate proxiable objects
// todo: depreacte data channel
var MPDataExchange = (function() {
    function MPDataExchange(comm, gameObj, namespace) {
        var self = this;

        self.execMethod = function(clientId, method, arguments) {
            var hostId = comm.getHost();
            sendTypedMessage(hostId,
                             'exec-method',
                             {
                                 clientId: clientId,
                                 method: method,
                                 arguments: Array.prototype.slice.call(arguments, [])
                             });
        };

        self.getData = function(clientId, variable, cb) {
            if (clientId === null) {
                clientId = comm.getHost();
            }

            var mcb = function(err, data) {
                if (err) {
                    return cb(err, data);
                }

                cb(err, data.data);
            };

            sendTypedMessage(comm.getHost(),
                             'get-data',
                             {
                                 clientId: clientId,
                                 variable: variable
                             },
                             mcb);
        };

        self.setData = function(clientId, variable, value, cb) {
            if (clientId === null) {
                clientId = comm.getHost();
            }
            sendTypedMessage(comm.getHost(),
                             'set-data',
                             {
                                 clientId: clientId,
                                 variable: variable,
                                 value: value
                             },
                             cb);
        };

        self.setView = function(clientId, displayName, props, cb) {
            sendTypedMessage(clientId,
                             'set-view',
                             {
                                 displayName: displayName,
                                 props: props
                             },
                             cb);
        };

        self._typedMessages = {};

        function sendTypedMessage(to, type, message, cb) {
            var uniqid = gen_uniqid('dxc-ack');

            if (cb && isFunction(cb)) {
                self._typedMessages[uniqid] = cb;
            }

            comm.send(to, {
                messageType: type,
                message: message,
                uniqid: uniqid,
                namespace: namespace
            });
        }

        function sendAckMessage(to, uniqid, err, message) {
            comm.send(to, {
                messageType: 'typed-message-ack',
                message: {
                    err: err,
                    data: message
                },
                uniqid: uniqid,
                namespace: namespace
            });
        }

        /**
         * Set-up events
         */
        comm.on('message', function(obj) {
            var incomingNamespace = obj.message.namespace;
            if (incomingNamespace !== namespace) {
                // wrong namespace. ignore
                return;
            }
            var from = obj.fromClientId;
            var type = obj.message.messageType;
            var message = obj.message.message;
            var uniqid = obj.message.uniqid;
            var ack = function(err, res) {
                sendAckMessage(from, uniqid, err, res);
            };

            switch(type) {
                case 'exec-method':
                {
                    var clientId = message.clientId;
                    var method = message.method;
                    var arguments = message.arguments;

                    if (gameObj.clientId !== comm.getHost()) {
                        throw(new Error("Only host should be invoking methods"));
                    }

                    gameObj.__execMethod(clientId, method, arguments);

                    break;
                }
                case 'get-data': // data request
                {
                    var variable = message.variable;
                    var clientId = message.clientId;

                    if (gameObj.clientId !== comm.getHost()) {
                        ack(new Error("Only host should store data"), null);
                        break;
                    }

                    var getDataCb = function(err, data) {
                        // todo: handle err

                        ack(err, {data: data});
                    };

                    if (clientId === comm.getHost()) {
                        gameObj.getData(variable, getDataCb);
                    } else {
                        gameObj.getPlayerData(clientId, variable, getDataCb);
                    }
                }
                break;

                case 'set-data': // data setting request
                {
                    var variable = message.variable;
                    var value = message.value;
                    var clientId = message.clientId;

                    if (gameObj.clientId !== comm.getHost()) {
                        ack(new Error("Only host should store data"), null);
                        break;
                    }

                    if (clientId === comm.getHost()) {
                        gameObj.setData(variable, value, ack);
                    } else {
                        gameObj.setPlayerData(clientId, variable, value, ack);
                    }
                }
                break;

                case 'typed-message-ack':
                {
                    if (typeof self._typedMessages[uniqid] === 'undefined') {
                        // ignore
                        break;
                    }

                    var cb = self._typedMessages[uniqid];
                    cb(message.err, message.data);
                    delete self._typedMessages[uniqid];

                }
                break;

                case 'set-view':
                {
                    var displayName = message.displayName;
                    var props = message.props;
                    var err = null;

                    gameObj.__setView(gameObj.clientId, displayName, props, gameObj.__container, ack);
                }
                break;
            }
        });

        comm.on('join-game', function(data) {
            gameObj.newClient(data);
        });
        comm.on('leave-game', function(data) {
            gameObj.disconnectClient(data);
        });
        comm.on('rejoin-game', function(data) {
            gameObj.rejoinClient(data);
        });

        return self;
    };

    return MPDataExchange;
})();
