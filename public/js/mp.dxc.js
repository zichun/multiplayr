/**
 * Multiplayr is designed to be data-driven, and hence we only allow data exchange in this intermediate protocol layer
 */
var MPDataExchange = (function() {
    function MPDataExchange(comm, gameObj) {
        var self = this;

        gameObj.dxc = this;

        self.getData = function(clientId, variable, cb) {
            if (clientId === null) {
                clientId = comm.getHost();
            }
            sendTypedMessage(clientId,
                             'get-data',
                             {
                                 variable: variable
                             },
                             cb);
        };

        self.setData = function(clientId, variable, value, cb) {
            if (clientId === null) {
                clientId = comm.getHost();
            }
            sendTypedMessage(clientId,
                            'set-data',
                            {
                                variable: variable,
                                value: value
                            },
                            cb);
        };

        self._typedMessages = {};

        function gen_uniqid() {
            return Math.random() + "-" + Math.random();
        }
        function sendTypedMessage(to, type, message, cb) {
            var uniqid = gen_uniqid();

            if (cb && isFunction(cb)) {
                self._typedMessages[uniqid] = cb;
            }

            comm.send(to, {
                type: type,
                message: message,
                uniqid: uniqid
            });
        }
        function sendAckMessage(to, uniqid, message) {
            comm.send(to, {
                type: 'typed-message-ack',
                message: message,
                uniqid: uniqid
            });
        }


        /**
         * Set-up events
         */
        comm.on('message', function(obj) {
            var from = obj.from;
            var type = obj.message.type;
            var message = obj.message.message;
            var uniqid = obj.message.uniqid;

            switch(type) {
                case 'get-data': // data request
                {
                    var variable = message.variable;
                    gameObj.getLocalData(variable, function(err, data) {
                        // todo: create proxy
                        // todo: handle err
                        sendAckMessage(from, uniqid, {
                            err: err,
                            data: data
                        });
                    });
                }
                break;

                case 'set-data': // data setting request
                {
                    var variable = message.variable;
                    var value = message.value;
                    gameObj.setLocalData(variable, value, function(err, data) {
                        sendAckMessage(from, uniqid, {
                            err: err,
                            data: data
                        });
                    });
                }
                break;

                case 'typed-message-ack':
                {
                    if (typeof self._typedMessages[uniqid] === 'undefined') {
                        // ignore
                        return;
                    }

                    var cb = self._typedMessages[uniqid];
                    cb(message.err, message.data);
                    delete self._typedMessages[uniqid];

                }
                break;
            }
        });

        return self;
    }


    return MPDataExchange;
})();