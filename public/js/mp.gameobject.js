var MPGameObject = (function() {
    var _secret = {};

    function MPGameObject(opt) {
        var self = this;
        var data = opt.data;

        self.roomId = opt.roomId;
        self.clientId = opt.clientId;
        self.container = opt.container || document.body;
        self.dxc = null;

        self.isHost = function() {
            return opt.isHost;
        };

        if (opt.playerData) {
            self.playerData = opt.playerData;
        }
        self.clients = {};

        if (data) {
            self._dataStore = CreateStore(data);
        }
        return self;
    }

    function CreateStore(dataObj) {
        var _store = {};

        for (var variable in dataObj) {
            _store[variable] = dataObj[variable].value;
        }

        /**
         * Exposes local variable store as synchronous operations
         */
        return function(challenge, variable) {
            if (challenge !== _secret) {
                throw(new Error("Access violation: this is a private method"));
            }

            if (typeof _store[variable] === 'undefined') {
                throw(new Error("Variable " + variable + " is not declared"));
            }

            return {
                get: function() {
                    return _store[variable];
                },
                set: function(newValue) {
                    // todo: call onchange event
                    // todo: check const-ness
                    _store[variable] = newValue;
                    return newValue;
                }
            };
        };
    }

    MPGameObject.prototype.setView =
        function MPGameObjectSetView(reactClass, props) {
            var self = this;
            React.renderComponent(reactClass(props), self.container);
            return self;
        };

    MPGameObject.prototype.getPlayerData =
        function MPGameObjectGetPlayerData(playerId, variable, cb) {
            var self = this;
            if (self.isHost() === false) {
                self.dxc.getData(playerId, variable, cb);
            } else {
                if (typeof self.clients[playerId] === 'undefined'){
                    cb(new Error("Client [" + playerId + "] does not exists"), null);
                } else if (self.clients[playerId].active === false) {
                    // todo: think about disconnection implication
                    cb(new Error("Client [" + playerId + "] has disconnected"), null);
                } else {
                    cb(null, self.clients[playerId].dataStore(_secret, variable).get());
                }
            }
            return self;
        };

    MPGameObject.prototype.setPlayerData =
        function MPGameObjectSetPlayerData(playerId, variable, value, cb) {
            var self = this;
            if (self.isHost() === false) {
                self.dxc.setData(playerId, variable, value, cb);
            } else {
                if (typeof self.clients[playerId] === 'undefined'){
                    cb(new Error("Client [" + playerId + "] does not exists"), null);
                } else if (self.clients[playerId].active === false) {
                    // todo: think about disconnection implication
                    cb(new Error("Client [" + playerId + "] has disconnected"), null);
                } else {
                    cb(null, self.clients[playerId].dataStore(_secret, variable).set(value));
                }
            }
            return self;
        };

    MPGameObject.prototype.setLocalData =
        function MPGameObjectSetLocalData(variable, value, cb) {
            var self = this;
            try {
                cb(null, self._dataStore(_secret, variable).set(value));
            } catch(e) {
                cb(e, false);
            }
            return self;
        };

    MPGameObject.prototype.getLocalData =
        function MPGameObjectGetLocalData(variable, cb) {
            var self = this;
            try {
                cb(null, self._dataStore(_secret, variable).get());
            } catch(e) {
                cb(e, false);
            }
            return self;
        };

    /**
     * Sends a request to get data from host. If it's the host calling this API,
     * we'll get it from localstore directly
     */
    MPGameObject.prototype.getData =
        function MPGameObjectGetData(variable, cb) {
            var self = this;
            if (self.isHost()) {
                // Current scope is host, and so data belongs to self
                self.getLocalData(variable, cb);
            } else {
                self.dxc.getData(null, variable, cb);
            }
            return self;
        };

    /**
     * Sends a request to set data on host. If it's the host calling this API,
     * we'll get it from localstore directly
     */
    MPGameObject.prototype.setData =
        function MPGameObjectSetData(variable, value, cb) {
            var self = this;
            if (self.isHost()) {
                // Current scope is host, and so data belongs to self
                self.setLocalData(variable, value, cb);
            } else {
                self.dxc.setData(null, variable, value, cb);
            }
            return self;
        };

    MPGameObject.prototype.newClient =
        function MPGameObjectNewClient(clientId) {
            if (self.isHost()) {
                self.clients[clientId] = {
                    active: true,
                    dataStore: CreateStore(self.playerData)
                };
            } else {
                // in this implementation of gameobject we'll force non-host to talk to host only
            }
        };

    MPGameObject.prototype.deleteClient =
        function MPGameObjectDeleteClient(clientId) {
            if (self.isHost()) {
                self.clients[clientId].active = false;
            } else {
                // in this implementation of gameobject we'll force non-host to talk to host only
            }
        };

    return MPGameObject;
})();