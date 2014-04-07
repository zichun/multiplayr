/**
 * Multiplayr is designed to be data-driven, and hence we only allow data exchange in this intermediate protocol layer
 * Data will only be stored in the host
 */
var MPDataExchange = (function() {
    function MPDataExchange(comm, gameObj) {
        var self = this;

        gameObj.dxc = this;

        self.getData = function(clientId, variable, cb) {
            if (clientId === null) {
                clientId = comm.getHost();
            }
            var mcb = function(err, data) {
                if (err) {
                    return cb(err, data);
                }

                if (data.proxy === true) {
                    cb(err, new MPDataProxy(data.data, self));
                } else {
                    cb(err, data.data);
                }
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

        self.invokeProxyMethod = function(clientId, uniqid, method, arguments, cb) {
            var self = this;
            var mcb = function(err, res) {
                // todo: proxify returns
                cb(err, res);
            };
            // todo: proxify arguments
            sendTypedMessage(clientId,
                             'invoke-proxy-method',
                             {
                                 uniqid: uniqid,
                                 method: method,
                                 arguments: arguments
                             },
                             mcb);
            return self;
        };

        self._typedMessages = {};

        function sendTypedMessage(to, type, message, cb) {
            var uniqid = gen_uniqid('dxc-ack');

            if (cb && isFunction(cb)) {
                self._typedMessages[uniqid] = cb;
            }

            comm.send(to, {
                type: type,
                message: message,
                uniqid: uniqid
            });
        }

        function sendAckMessage(to, uniqid, err, message) {
            comm.send(to, {
                type: 'typed-message-ack',
                message: {
                    err: err,
                    data: message
                },
                uniqid: uniqid
            });
        }

        function createProxySpecs(data, owner) {
            var tr = {};

            if (!(data instanceof MPDataExchangable)) {
                throw(new Error("Only MPDataExchangable objects can be proxied"));
            } else if (typeof data.__dxc_uniqid === 'undefined') {
                throw(new Error("Uniqid of data object is not defined. Did you forget to call the superclass constructor?"));
            }

            for (var x in data) {
                if (isFunction(data[x])) {
                    tr[x] = {
                        proxy: true
                    };
                } else {
                    // todo: deep proxying
                    tr[x] = {
                        proxy: false,
                        value: data[x]
                    };
                }
            }
            return {
                uniqid: data.__dxc_uniqid,
                owner: owner,
                data: tr
            };
        }

        /**
         * Set-up events
         */
        comm.on('message', function(obj) {
            var from = obj.from;
            var type = obj.message.type;
            var message = obj.message.message;
            var uniqid = obj.message.uniqid;
            var ack = function(err, res) {
                sendAckMessage(from, uniqid, err, res);
            };

            switch(type) {
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

                        var proxy = false;
                        if (data instanceof MPDataExchangable) {
                            proxy = true;
                            data = createProxySpecs(data, gameObj.clientId);
                        }

                        ack(err, {data: data, proxy: proxy});
                    };

                    if (clientId === comm.getHost()) {
                        gameObj.getLocalData(variable, getDataCb);
                    } else {
                        gameObj.getlayerData(clientId, variable, getDataCb);
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
                        gameObj.setLocalData(variable, value, ack);
                    } else {
                        gameObj.setlayerData(clientId, variable, value, ack);
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

                case 'invoke-proxy-method':
                {
                    var objUniqid = message.uniqid;
                    var originalObj = MPDataExchangable.getObjectByUniqid(objUniqid);
                    var method = message.method;
                    var arguments = message.arguments;

                    if (typeof originalObj === 'undefined') {
                        ack(new Error("No such object"), null);
                        break;
                    }

                    arguments[arguments.length] = ack;
                    originalObj[method].apply(originalObj, arguments);

                }
                break;
            }
        });

        comm.on('join-room', function(data) {
            gameObj.newClient(data.message);
        });
        comm.on('leave-room', function(data) {
            gameObj.deleteClient(data.message);
        });

        return self;
    };

    /**
     * DataProxy class
     * This is the object that gets instantiated on the caller end, with fake methods replacing
     * actual object methods which will be used to proxy the call to the object owner
     */
    var MPDataProxy = (function() {
        function MPDataProxy(proxySpec, dxc) {
            var self = this;

            self.uniqid = proxySpec.uniqid;
            self.owner = proxySpec.owner;
            self.initialize(proxySpec.data);
            self.dxc = dxc;

            return self;
        }

        MPDataProxy.prototype.initialize =
            function MPDataProxyInitialize(proxySpecData) {
                var self = this;

                function createProxyFunction(method) {
                    return function() {
                        // assumption is that the last argument is a callback
                        if (arguments.length === 0) {
                            throw(new Error("DataProxyObject requires at least one callback function as argument"));
                        }
                        var cb = arguments[arguments.length - 1];
                        var args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
                        self.dxc.invokeProxyMethod(self.owner, self.uniqid, method, args, cb);
                    };
                }

                for (var method in proxySpecData) {
                    if (proxySpecData[method].proxy === true) {
                        self[method] = createProxyFunction(method);
                    } else {
                        self[method] = proxySpecData[method].value;
                    }
                }

                return self;
            };

        return MPDataProxy;
    })();

    return MPDataExchange;
})();

var MPDataExchangable = (function() {
    var dxc_table = {};

    function MPDataExchangable() {
        var self = this;

        self.__dxc_uniqid = gen_uniqid('dxc-obj');
        dxc_table[self.__dxc_uniqid] = self;

        return self;
    }

    MPDataExchangable.getObjectByUniqid = function(uniqid) {
        return dxc_table[uniqid];
    };

    return MPDataExchangable;
})();

function Stack() {
    var self = this;
    self.data = [];

    MPDataExchangable.call(this);

    return self;
}

Stack.Inherits(MPDataExchangable);

Stack.prototype.push = function(x, cb) {
    this.data.push(x);
    cb(null, this.data.length);
};

Stack.prototype.pop = function(cb) {
    cb(null, (this.data.splice(0, this.data.length - 1))[0]);
};

Stack.prototype.length = function(cb) {
    cb(null, this.data.length);
};
