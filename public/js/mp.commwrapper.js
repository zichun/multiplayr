/**
 * Multiplayr is designed to be data-driven, and hence we only allow data exchange in this intermediate protocol layer
 */
var MPDataExchange = (function() {
    function MPDataExchange(comm) {
        var self = this;

        self.getData = function(clientId, variable, cb) {
            sendTypedMessage(clientId,
                             'get-data',
                             {
                                 variable: variable
                             },
                             cb);
        };

        self.setData = function(clientId, variable, value, cb) {
            sendTypeMessage(clientId,
                            'set-data',
                            {
                                variable: variable,
                                value: value
                            },
                            cb);
        };

        self._typedMessages = {};

        function uniqid() {
            return Math.random() + "-" + Math.random();
        }
        function sendTypedMessage(to, type, message, cb) {
            var uniqid = uniqid();

            if (cb && isFunction(cb)) {
                self._typedMessages[uniqid] = cb;
            }

            comm.send(to, {
                type: type,
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
                    gameObject.getLocalData(variable, function(err, data) {
                        // todo: create proxy
                        // todo: handle err
                        sendTypedMessage(from, 'typed-message-ack', data, null);
                    });
                }
                break;

                case 'set-data': // data setting request
                {
                    var variable = message.variable;
                    var value = message.value;
                    gameObject.setLocalData(variable, value, function(err, data) {
                        sendTypedMessage(from, 'typed-message-ack', value, null);
                    });
                }
                break;

                case 'typed-message-ack':
                {
                    if (typeof self._typedMessages[uniqid] === 'undefined') {
                        // ignore
                        return;
                    }

                    var cb = self._typedMessage[uniqid];
                    cb(message);
                    delete self._typedMessage[uniqid];

                }
                break;
            }
        });

        return self;
    }


    return MPDataExchange;
})();