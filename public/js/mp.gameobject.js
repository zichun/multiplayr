var MPGameObject = (function() {
    var _secret = {};
    var NAMESPACE_DELIMITER = '_';

    function MPGameObject(
        rule /* Game Rule */,
        comm /* MPProtocol object */,
        roomId,
        clientId,
        isHost,
        container /* (optional) DOM object to render views in. default to document.body */,
        namespace /* (optional) namespace string for all variables and methods */,
        parent /* (optional) parent MPGameObject */,
        secret /* (optional) shares secret */
    ) {
        var self = this;

        namespace = namespace || '';

        self.roomId = roomId;
        self.clientId = clientId;
        self.__onDataChange = rule.onDataChange;
        self.__container = container || document.body;
        self.__views = rule.views;
        self.__dxc = new MPDataExchange(comm, self, namespace);

        self.__namespace = namespace;
        self.__parent = parent;

        self.__methods = rule.methods;
        self.Methods = SetUpMethods(rule.methods, isHost, self);

        self.isHost = function() {
            return isHost;
        };

        if (isHost) {
            self._dataStore = CreateStore(rule.globalData, self);

            self.clients = [];
            self.__clientsData = {};
            self.__props = {};
            self.__props[clientId] = {
                view: '',
                props: {}
            };

            self.playerData = rule.playerData;
        }

        if (secret) {
            // all gameobjects in the hierarchy shares the secret token
            _secret = secret;
        }

        self.__plugins = {};
        var prefix = namespace === '' ? '' : namespace + NAMESPACE_DELIMITER;
        for (var plugin in rule.plugins) {
            if (rule.plugins.hasOwnProperty(plugin)) {
                if (typeof plugin !== 'string' || plugin.match(/[^a-zA-Z]/)) {
                    throw(new Error("Invalid plugin name: namespace must be purely alpha"));
                }
                self.__plugins[plugin] = new MPGameObject(
                    rule.plugins[plugin], comm, roomId, clientId, isHost, container, prefix + plugin, self, _secret
                );
            }
        }


        if (self.__parent) {
            self.Methods.__parent = self.__parent.Methods;
        }

        if (isHost && !parent) {
            self.__init(_secret);
        }
        return self;
    }

    MPGameObject.prototype.__init =
        function MPGameObjectInit(_password) {
            // goes down plugin's tree hierarchy, and run dataChange on leaf nodes
            var self = this, found = false;
            if (_password !== _secret) {
                throw(new Error("Access denied"));
            }
            for (var plugin in self.__plugins) {
                if (self.__plugins.hasOwnProperty(plugin)) {
                    found = true;
                    self.__plugins[plugin].__init(_secret);
                }
            }

            if (found === false) {
                self.dataChange();
            }
        };

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

    /* Extract out */
    function getFirstNamespace(variable) {
        var s = variable.split('_');
        if (s.length === 0) {
            return [false, variable];
        } else {
            var namespace = s[0];
            return [namespace, s.slice(1, s.length).join("_")];
        }
    }
    function safeCb(cb) {
        if (isFunction(cb)) {
            return cb;
        } else {
            return function(err, doc) {
                if (err) {
                    throw(err);
                } else {
                    return doc;
                }
                return null;
            };
        }
    }

    /**
     * Sends a request to get data from host. If it's the host calling this API,
     * we'll get it from localstore directly
     */
    MPGameObject.prototype.getData =
        function MPGameObjectGetData(variable, cb) {
            var self = this;
            var mcb = safeCb(cb);

            if (self.isHost()) {
                // Current scope is host, and so data belongs to self

                if (self.__hasLocalData(_secret, variable)) {
                    self.__getLocalData(_secret, variable, mcb);
                } else {
                    var splits = getFirstNamespace(variable);
                    var namespace = splits[0];

                    if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                        mcb(new Error("Variable ["+variable+"] does not exists"));
                    } else {
                        self.__plugins[namespace].getData(splits[1], mcb);
                    }
                }
            } else {
                self.__dxc.getData(null, variable, mcb);
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
            var mcb = safeCb(cb);
            if (self.isHost()) {
                // Current scope is host, and so data belongs to self
                if (self.__hasLocalData(_secret, variable)) {
                    self.__setLocalData(_secret, variable, value, mcb);
                } else {
                    var splits = getFirstNamespace(variable);
                    var namespace = splits[0];

                    if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                        mcb(new Error("Variable ["+variable+"] does not exists"));
                    } else {
                        self.__plugins[namespace].setData(splits[1], value, mcb);
                    }
                }
            } else {
                self.__dxc.setData(null, variable, value, mcb);
            }
            return self;
        };

    MPGameObject.prototype.getPlayerData =
        function MPGameObjectGetPlayerData(playerId, variable, cb) {
            var self = this;
            var mcb = safeCb(cb);
            if (self.isHost() === false) {
                self.__dxc.getData(playerId, variable, mcb);
            } else {
                if (typeof self.__clientsData[playerId] === 'undefined'){
                    mcb(new Error("Client [" + playerId + "] does not exists"), null);
                } else if (self.__clientsData[playerId].active === false) {
                    // todo: think about disconnection implication
                    mcb(new Error("Client [" + playerId + "] has disconnected"), null);
                } else {
                    if (self.__hasPlayerData(_secret, playerId, variable)) {
                        mcb(null, self.__clientsData[playerId].dataStore(_secret, variable).get());
                    } else {
                        var splits = getFirstNamespace(variable);
                        var namespace = splits[0];

                        if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                            mcb(new Error("Variable ["+variable+"] does not exists"));
                        } else {
                            self.__plugins[namespace].getPlayerData(playerId, splits[1], mcb);
                        }
                    }
                }
            }
            return self;
        };

    MPGameObject.prototype.setPlayerData =
        function MPGameObjectSetPlayerData(playerId, variable, value, cb) {
            var self = this;
            var mcb = safeCb(cb);
            if (self.isHost() === false) {
                self.__dxc.setData(playerId, variable, value, mcb);
            } else {
                if (typeof self.__clientsData[playerId] === 'undefined'){
                    mcb(new Error("Client [" + playerId + "] does not exists"), null);
                } else if (self.__clientsData[playerId].active === false) {
                    // todo: think about disconnection implication
                    mcb(new Error("Client [" + playerId + "] has disconnected"), null);
                } else {
                    if (self.__hasPlayerData(_secret, playerId, variable)) {
                        mcb(null, self.__clientsData[playerId].dataStore(_secret, variable).set(value));
                    } else {
                        var splits = getFirstNamespace(variable);
                        var namespace = splits[0];

                        if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                            mcb(new Error("Variable ["+variable+"] does not exists"));
                        } else {
                            self.__plugins[namespace].setPlayerData(playerId, splits[1], value, mcb);
                        }
                    }
                }
            }
            return self;
        };

    MPGameObject.prototype.__hasLocalData =
        function MPGameObjectHasLocalData(_password, variable) {
            var self = this;
            if (_password !== _secret) {
                throw(new Error("Access denied"));
            }
            try {
                self._dataStore(_secret, variable);
                return true;
            } catch(e) {
                return false;
            }
        };

    MPGameObject.prototype.__hasPlayerData =
        function MPGameObjectHasPlayerData(_password, playerId, variable) {
            var self = this;
            if (_password !== _secret) {
                throw(new Error("Access denied"));
            }
            try {
                self.__clientsData[playerId].dataStore(_secret, variable);
                return true;
            } catch(e) {
                return false;
            }
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

    MPGameObject.prototype.setView =
        function MPGameObjectSetView(clientId, view) {
            var self = this;
            if (self.isHost()) {
                self.__props[clientId].view = view;
            } else {
                throw(new Error("Only host can call setViewProps"));
            }
            return self;
        };

    MPGameObject.prototype.setViewProps =
        function MPGameObjectSetViewProps(clientId, key, value) {
            // todo: maybe expose this API only for ondatachange, to enforce data drivenness
            var self = this;
            if (self.isHost()) {
                self.__props[clientId].props[key] = value;
            } else {
                // todo: rethink whether we only want to restrict host to deal with data changes, by design
                throw(new Error("Only host can call setViewProps"));
            }
            return self;
        };

    MPGameObject.prototype.deleteViewProps =
        function MPGameObjectDeleteViewProps(clientId, key) {
            delete self.__props[clientId].props[key];
        };

    MPGameObject.prototype.newClient =
        function MPGameObjectNewClient(clientId) {
            var self = this;
            if (self.isHost()) {
                self.clients.push(clientId);
                self.__clientsData[clientId] = {
                    active: true,
                    dataStore: CreateStore(self.playerData, self)
                };
                self.__props[clientId] = {
                    view: '',
                    props: {}
                };
                // todo: only dataChange for leafs
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
                self.__clientsData[clientId].active = false;
                // todo: only dataChange for leafs
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
                if (isFunction(self.__onDataChange)) {
                    self.__onDataChange.call(self, function(toRender) {
                        if (self.__parent) {
                            for (var client in self.__props) {
                                if (!self.__props.hasOwnProperty(client)) {
                                    continue;
                                }
                                self.__parent.setViewProps(client, self.__namespace, self.__props[client].props);
                            }
                        }
                        if (toRender) {
                            if (self.__parent) {
                                // propagate datachange upwards
                                self.__parent.dataChange();
                            } else {
                                self.__renderViews(_secret);
                            }
                        }
                    });
                } else if (self.__parent) {
                    self.__parent.dataChange();
                }
            } else {
                // todo: forward datachange request to host
                throw(new Error("Unimplemented"));
            }
            return self;
        };

    MPGameObject.prototype.__renderViews =
        function MPGameObjectRenderViews(_password) {
            var self = this;
            if (_password !== _secret) {
                throw(new Error("Access denied"));
            }

            if (self.__parent) {
                throw(new Error("Only top level gameobject can render views"));
            }

            var promises = [];
            for (var client in self.__props) {
                if (self.__props.hasOwnProperty(client)) {
                    if (self.__props[client].view !== '') {
                        promises.push(self.Q__setView(client, self.__props[client].view, self.__props[client].props));
                    }
                }
            }

            Q.allSettled(promises)
             .then(function(results) {
             })
             .fail(console.error);
        };

    MPGameObject.prototype.__getView =
        function MPGameObjectGetView(displayName) {
            var self = this;
            return self.__views[displayName];
        };

    MPGameObject.prototype.__setView =
        function MPGameObjectSetView(clientId, displayName, props, cb) {
            var self = this;
            var mcb = safeCb(cb);
            props = props || {};

            if (self.isHost() === false && clientId !== self.clientId) {
                // todo: clients should be able to setview too. or maybe not
                mcb(new Error("Only host can set views"), displayName);
            }

            if (clientId === null || clientId === self.clientId) {
                // this means that clientId matches request. we'll go ahead to render the view
                try {
                    if (typeof self.__views[displayName] !== 'undefined') {
                        // we have this view
                        self.__renderReactView(_secret, displayName, props, mcb);
                    } else {
                        // we'll forward it to a plugin
                        var splits = getFirstNamespace(displayName);
                        var namespace = splits[0];
                        if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                            throw(new Error("No such views: " + displayName));
                        } else {
                            self.__plugins[namespace].__setView(clientId, splits[1], props[namespace], mcb);
                        }
                    }
                } catch(e) {
                    mcb(e, displayName);
                }
            } else {
                // Not me. forward request to client
                self.__dxc.setView(clientId, displayName, props, mcb);
            }

            return self;
        };

    MPGameObject.prototype.__renderReactView =
        function(_password, reactDisplayName, props, cb) {
            var self = this;

            if (_password !== _secret) {
                throw(new Error("Access denied"));
            }

            var reactClass = self.__getView(reactDisplayName);

            props = props || {};

            props.Methods = self.Methods;

            cb(null,
               React.renderComponent(reactClass(props), self.__container));

            return self;
        };

    MPGameObject.prototype.__execMethod =
        function MPGameObjectExecMethod(callee, method, arguments) {
            var self = this;
            if (!self.isHost()) {
                throw(new Error("Invalid call: only host can invoke methods"));
            }

            if (typeof self.__methods[method] === 'undefined') {
                throw(new Error("Invalid argument: method ["+method+"] is not defined"));
            }

            var args = [callee].concat(arguments);
            return self.__methods[method].apply(self, args);
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
            var mcb = (function() {
                var called = false;

                return function(err, res) {
                    if (called === true) return;
                    called = true;
                    cb(err, res);
                };
            })();

            var cnter = self.clients.length;
            var accumulatedResults = {};

            if (cnter === 0) {
                mcb(null, accumulatedResults);
                return self;
            }

            self.clients.forEach(function(client) {
                self.getPlayerData(client, variable, function(err, res) {
                    accumulatedResults[client] = res;

                    if (err) {
                        mcb(err, variable);
                    }

                    cnter--;
                    if (cnter === 0) {
                        mcb(null, accumulatedResults);
                    }
                });
            });

            return self;
        };


    // Make function promises
    var _toQ = ['getData', 'setData', 'getPlayerData', 'setPlayerData', 'getPlayersData', '__setView'];
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


    /**
     * Helper Functions
     */
    function SetUpMethods(methods, isHost, gameObj) {
        var obj = {};

        function hostMethodWrapper(method) {
            return function() {
                gameObj.__execMethod(gameObj.clientId, method, arguments);
            };
        }

        function clientMethodWrapper(method) {
            return function() {
                gameObj.__dxc.execMethod(gameObj.clientId, method, arguments);
            };
        }

        for (var method in methods) {
            if (!methods.hasOwnProperty(method)) {
                continue;
            }

            if (isHost) {
                obj[method] = hostMethodWrapper(method);
            } else {
                obj[method] = clientMethodWrapper(method);
            }
        }

        return obj;
    }

    return MPGameObject;
})();
