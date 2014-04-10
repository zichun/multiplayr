var MPGameObject = (function() {
    var _secret = {};

    function MPGameObject(rule, roomId, clientId, isHost, container, parent) {
        var self = this;

        self.roomId = roomId;
        self.clientId = clientId;
        self.onDataChange = rule.onDataChange;
        self.container = container || document.body;
        self._views = rule.views;
        self.dxc = null;

        self.isHost = function() {
            return isHost;
        };

        if (isHost) {
            self._dataStore = CreateStore(rule.globalData, self);

            self.clients = [];
            self._clientsData = {};
            self.dataChange();
            self.playerData = rule.playerData;
        }

        self.__plugins = {};
        for (var plugin in rule.plugins) {
            if (rule.plugins.hasOwnProperty(plugin)) {
                if (typeof plugin !== 'string' || plugin.match(/^[a-zA-Z]/)) {
                    throw(new Error("Invalid plugin name: namespace must be purely alpha"));
                }
                self.__plugins[plugin] = new MPGameObject(rule.plugins[plugin], roomId, clientId, isHost, container, self);
            }
        }

        self.__setDxc = function(dxc, namespace) {
            // todo: should instantiate one dxc object per gameobject instance
            self.dxc = dxc;
            for (var plugin in self.__plugins) {
                if (self.__plugins.hasOwnProperty(plugin)) {
                    self.__plugins(plugin).__setDxc(dxc, namespace + '_' + dxc);
                }
            }
        };

        return self;
    }

    function CreateStore(dataObj, gameObj) {
        var _store = {};

        for (var variable in dataObj) {
            if (dataObj.hasOwnProperty(variable)) {
                if (typeof dataObj[variable].value !== 'undefined') {
                    _store[variable] = dataObj[variable].value;
                } else if (typeof dataObj[variable].type !== 'undefined') {
                    _store[variable] = new dataObj[variable].type(dataObj[variable].init);
                }
            }
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

                    if (dataObj[variable].const === true) {
                        throw(new Error("Variable ["+variable+"] is constant"));
                    }

                    _store[variable] = newValue;

                    gameObj.dataChange();
                    return newValue;
                }
            };
        };
    }

    MPGameObject.prototype.getPlayerData =
        function MPGameObjectGetPlayerData(playerId, variable, cb) {
            var self = this;
            if (self.isHost() === false) {
                self.dxc.getData(playerId, variable, cb);
            } else {
                if (typeof self._clientsData[playerId] === 'undefined'){
                    cb(new Error("Client [" + playerId + "] does not exists"), null);
                } else if (self._clientsData[playerId].active === false) {
                    // todo: think about disconnection implication
                    cb(new Error("Client [" + playerId + "] has disconnected"), null);
                } else {
                    cb(null, self._clientsData[playerId].dataStore(_secret, variable).get());
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
                var mcb = function(err, res) {
                    if (isFunction(cb)) {
                        cb(err, res);
                    } else if (err) {
                        throw(err);
                    }
                };

                if (typeof self._clientsData[playerId] === 'undefined'){
                    mcb(new Error("Client [" + playerId + "] does not exists"), null);
                } else if (self._clientsData[playerId].active === false) {
                    // todo: think about disconnection implication
                    mcb(new Error("Client [" + playerId + "] has disconnected"), null);
                } else {
                    mcb(null, self._clientsData[playerId].dataStore(_secret, variable).set(value));
                }
            }
            return self;
        };

    MPGameObject.prototype.__setLocalData =
        function MPGameObjectSetLocalData(_password, variable, value, cb) {
            if (_password !== _secret) {
                throw(new Error("Access denied"));
            }
            var self = this;
                var mcb = function(err, res) {
                    if (isFunction(cb)) {
                        cb(err, res);
                    } else if (err) {
                        throw(err);
                    }
                };

                try {
                    mcb(null, self._dataStore(_secret, variable).set(value));
                } catch(e) {
                    mcb(e, false);
                }

            return self;
        };

    MPGameObject.prototype.__getLocalData =
        function MPGameObjectGetLocalData(_password, variable, cb) {
            if (_password !== _secret) {
                throw(new Error("Access denied"));
            }
            var self = this;
            if (isFunction(cb)) {
                try {
                    cb(null, self._dataStore(_secret, variable).get());
                } catch(e) {
                    cb(e, false);
                }
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
                self.__getLocalData(_secret, variable, cb);
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
                self.__setLocalData(_secret, variable, value, cb);
            } else {
                self.dxc.setData(null, variable, value, cb);
            }
            return self;
        };

    MPGameObject.prototype.newClient =
        function MPGameObjectNewClient(clientId) {
            var self = this;
            if (self.isHost()) {
                self.clients.push(clientId);
                self._clientsData[clientId] = {
                    active: true,
                    dataStore: CreateStore(self.playerData, self)
                };
                self.dataChange();
            } else {
                // in this implementation of gameobject we'll force non-host to talk to host only
            }
            return self;
        };

    MPGameObject.prototype.deleteClient =
        function MPGameObjectDeleteClient(clientId) {
            var self = this;
            if (self.isHost()) {
                self.clients.splice(self.clients.indexOf(clientId), 1);
                self._clientsData[clientId].active = false;
                self.dataChange();
            } else {
                // in this implementation of gameobject we'll force non-host to talk to host only
            }
            return self;
        };

    MPGameObject.prototype.dataChange =
        function MPGameObjectDataChange() {
            var self = this;
            if (self.isHost()) {
                var cb = {
                    setView: function() {
                    },
                    setProps: function() {
                    },
                    commit: function() {
                    }
                };
                self.onDataChange.call(self, self);
            } else {
                // todo: forward datachange request to host
                throw(new Error("Unimplemented"));
            }
            return self;
        };

    MPGameObject.prototype.getView =
        function MPGameObjectGetView(displayName) {
            var self = this;
            return self._views[displayName];
        };

    MPGameObject.prototype.setView =
        function MPGameObjectSetView(clientId, displayName, props, cb) {
            var self = this;

            if (self.isHost() === false) {
                throw(new Error("Only host can set views"));
            }

            if (clientId === null || clientId === self.clientId) {
                self._renderReactView(displayName, props);
            } else {
                self.dxc.setView(clientId, displayName, props, cb);
            }

            return self;
        };

    MPGameObject.prototype._renderReactView =
        function(reactDisplayName, props) {
            var self = this;
            var reactClass = self.getView(reactDisplayName);
            props = props || {};
            props.MPGameObject = self;
            React.renderComponent(reactClass(props), self.container);
            return self;
        };


    /**
     * Sugars for gameobject
     */
    MPGameObject.prototype.getPlayersData =
        function MPGameObjectGetPlayersData(variable, cb) {
            var self = this;
            if (!self.isHost()) {
                throw(new Error("Invalid call: only host can accumulate all players data"));
            }

            var cnter = self.clients.length;
            var accumulatedResults = {};

            if (cnter === 0) {
                cb(null, accumulatedResults);
                return self;
            }

            self.clients.forEach(function(client) {
                self.getPlayerData(client, variable, function(err, res) {
                    accumulatedResults[client] = {
                        err: err,
                        data: res
                    };

                    cnter--;
                    if (cnter === 0) {
                        cb(null, accumulatedResults);
                    }
                });
            });

            return self;
        };


    // Make function promises
    var _toQ = ['getData', 'setData', 'getPlayerData', 'setPlayerData', 'getPlayersData'];
    _toQ.forEach(function(method) {
        MPGameObject.prototype['Q' + method] = function() {
            var self = this;
            var deferred = Q.defer();
            var args = [];

            for (var i=0;i<arguments.length;++i) {
                args.push(arguments[i]);
            }
            args.push(function(err, res) {
                if (err) {
                    deferred.reject(new Error(err));
                } else {
                    deferred.resolve(res);
                }
            });

            self[method].apply(this, args);

            return deferred.promise;
        };
    });

    return MPGameObject;
})();
