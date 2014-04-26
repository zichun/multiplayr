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
        self.MP = SetUpMethods(rule.methods, isHost, self);

        self.isHost = function() {
            return isHost;
        };

        self.__hasDelta = false;

        if (isHost) {
            self._dataStore = CreateStore(rule.globalData, self);

            self.clients = [];
            self.__clientsData = {};
            self.__props = {};
            self.__props[clientId] = {};

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
            self.MP.__parent = self.__parent.MP;
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
                self.dataChange(true);
            }
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
            return this._dataStore(_secret, variable).set(value);
        };

    MPGameObject.prototype.__getLocalData =
        function MPGameObjectGetLocalData(_password, variable, cb) {
            if (_password !== _secret) {
                throw(new Error("Access denied"));
            }
            return this._dataStore(_secret, variable).get();
        };


    MPGameObject.prototype.newClient =
        function MPGameObjectNewClient(clientId) {
            var self = this;
            if (self.isHost()) {
                if (!self.__parent) {
                    self.addNewClient(clientId);
                    self.dataChange(true);
                }
            } else {
                // in this implementation of gameobject we'll force non-host to talk to host only
            }
            return self;
        };

    MPGameObject.prototype.addNewClient =
        function MPGameObjectAddNewClient(clientId) {
            var self = this;
            if (!self.isHost()) {
                throw(new Error("Only host can call addNewClient"));
            }

            for (var plugin in self.__plugins) {
                if (self.__plugins.hasOwnProperty(plugin)) {
                    self.__plugins[plugin].addNewClient(clientId);
                }
            }

            self.clients.push(clientId);
            self.__clientsData[clientId] = {
                active: true,
                dataStore: CreateStore(self.playerData, self)
            };

            self.__props[clientId] = {
                view: '',
                props: {}
            };

            self.dataChange();

            return self;
        };

    MPGameObject.prototype.deleteClient =
        function MPGameObjectDeleteClient(clientId) {
            var self = this;
            if (self.isHost()) {
                self.clients.splice(self.clients.indexOf(clientId), 1);
                self.__clientsData[clientId].active = false;
                self.dataChange(true);
            } else {
                // in this implementation of gameobject we'll force non-host to talk to host only
            }
            return self;
        };

    MPGameObject.prototype.processTick =
        function MPGameObjectProcessTick() {
            var self = this;
            var changed = false;

            if (self.isHost()) {
                for (var plugin in self.__plugins) {
                    if (self.__plugins.hasOwnProperty(plugin)) {
                        changed |= self.__plugins[plugin].processTick();
                    }
                }

                if ((changed || self.__hasDelta) &&
                    isFunction(self.__onDataChange))
                {
                    self.__hasDelta = false;
                    var render = self.__onDataChange.call(self.MP);

                    if (self.__parent) {
                        for (var client in self.__props) {
                            if (!self.__props.hasOwnProperty(client)) {
                                continue;
                            }
                            self.__parent.setViewProps(client, getLastNamespace(self.__namespace), self.__props[client]);
                        }
                    }

                    if (render && !self.__parent) {
                        self.__renderViews(_secret);
                    }

                    changed = true;
                }
            } else {
                // todo: proper convention for error
                // or better still, don't expose this to client in the first place
            }

            return changed;
        };

    MPGameObject.prototype.tick =
        function MPGameObjectTick() {
            var self = this;
            var changed = false;

            if (self.isHost()) {
                if (self.__parent) {
                    return self.__parent.tick();
                } else {
                    return self.processTick();
                }
            }
        };

    MPGameObject.prototype.dataChange =
        function MPGameObjectDataChange(forceTick) {
            var self = this;
            if (self.isHost()) {

                self.__hasDelta = true;
                if (self.__parent) {
                    self.__parent.dataChange();
                }

                if (forceTick) {
                    self.tick();
                }

            } else {
                throw(new Error("Invalid call"));
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
                    if (self.__props[client]['__view'] !== '') {
                        promises.push(self.Q__setView(client, self.__props[client]['__view'], self.__props[client], self.__container));
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
        function MPGameObjectSetView(clientId, displayName, props, container, cb) {
            var self = this;
            var mcb = safeCb(cb);
            props = props || {};

            if (container && !self.isHost()) {
                if (typeof self.__props === 'undefined') self.__props = {};
                if (typeof self.__props[clientId] === 'undefined') self.__props[clientId] = {};
                self.__props[clientId] = props;
            }

            if (self.isHost() === false && clientId !== self.clientId) {
                mcb(new Error("Only host can set views"), displayName);
            }

            if (clientId === null || clientId === self.clientId) {
                // this means that clientId matches request. we'll go ahead to render the view
                try {
                    if (typeof self.__views[displayName] !== 'undefined') {
                        // we have this view
                        var view = self.__runReactView(_secret, displayName, props);
                        if (container) {
                            mcb(null,
                                React.renderComponent(view, container));
                        } else {
                            // todo: hackish. abstract out as a sync op
                            return view;
                        }
                    } else {
                        // we'll forward it to a plugin
                        var splits = getFirstNamespace(displayName);
                        var namespace = splits[0];
                        if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                            throw(new Error("No such views: " + displayName));
                        } else {
                            return self.__plugins[namespace].__setView(clientId, splits[1], props[namespace], container, mcb);
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

    MPGameObject.prototype.__runReactView =
        function(_password, reactDisplayName, props) {
            var self = this;

            if (_password !== _secret) {
                throw(new Error("Access denied"));
            }

            var reactClass = self.__getView(reactDisplayName);

            props = props || {};

            props.MP = self.MP;

            return reactClass(props);
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
            var tr = self.__methods[method].apply(self.MP, args);
            self.tick();
            return tr;
        };

    ///
    /// Methods that will be exposed to game rules
    ///
    MPGameObject.prototype.getData =
        function MPGameObjectGetData(variable, cb) {
            var self = this;

            if (self.isHost()) {
                // Current scope is host, and so data belongs to self

                if (self.__hasLocalData(_secret, variable)) {
                    return self.__getLocalData(_secret, variable);
                } else {
                    var splits = getFirstNamespace(variable);
                    var namespace = splits[0];

                    if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                        throw(new Error("Variable ["+variable+"] does not exists"));
                    } else {
                        return self.__plugins[namespace].getData(splits[1]);
                    }
                }
            } else {
                throw(new Error("Only host can get data"));
            }
            return self;
        };

    MPGameObject.prototype.setData =
        function MPGameObjectSetData(variable, value, cb) {
            var self = this;

            if (self.isHost()) {
                // Current scope is host, and so data belongs to self
                if (self.__hasLocalData(_secret, variable)) {
                    return self.__setLocalData(_secret, variable, value);
                } else {
                    var splits = getFirstNamespace(variable);
                    var namespace = splits[0];

                    if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                        throw(new Error("Variable ["+variable+"] does not exists"));
                    } else {
                        self.__plugins[namespace].setData(splits[1], value);
                    }
                }
            } else {
                throw(new Error("Only host can set data"));
            }

            return self;
        };

    MPGameObject.prototype.getPlayerData =
        function MPGameObjectGetPlayerData(playerId, variable, cb) {
            var self = this;

            if (self.isHost() === false) {
                throw(new Error("Only host can get player data"));
            } else {
                if (typeof self.__clientsData[playerId] === 'undefined'){
                    throw(new Error("Client [" + playerId + "] does not exists"));
                } else if (self.__clientsData[playerId].active === false) {
                    // todo: think about disconnection implication
                    throw(new Error("Client [" + playerId + "] has disconnected"));
                } else {
                    if (self.__hasPlayerData(_secret, playerId, variable)) {
                        return self.__clientsData[playerId].dataStore(_secret, variable).get();
                    } else {
                        var splits = getFirstNamespace(variable);
                        var namespace = splits[0];

                        if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                            throw(new Error("Variable ["+variable+"] does not exists"));
                        } else {
                            return self.__plugins[namespace].getPlayerData(playerId, splits[1]);
                        }
                    }
                }
            }
            return self;
        };

    MPGameObject.prototype.setPlayerData =
        function MPGameObjectSetPlayerData(playerId, variable, value, cb) {
            var self = this;

            if (self.isHost() === false) {
                throw(new Error("Only host can set player data"));
            } else {
                if (typeof self.__clientsData[playerId] === 'undefined'){
                    throw(new Error("Client [" + playerId + "] does not exists"));
                } else if (self.__clientsData[playerId].active === false) {
                    // todo: think about disconnection implication
                    throw(new Error("Client [" + playerId + "] has disconnected"));
                } else {
                    if (self.__hasPlayerData(_secret, playerId, variable)) {
                        return self.__clientsData[playerId].dataStore(_secret, variable).set(value);
                    } else {
                        var splits = getFirstNamespace(variable);
                        var namespace = splits[0];

                        if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                            throw(new Error("Variable ["+variable+"] does not exists"));
                        } else {
                            self.__plugins[namespace].setPlayerData(playerId, splits[1], value);
                        }
                    }
                }
            }
            return self;
        };

    MPGameObject.prototype.setView =
        function MPGameObjectSetView(clientId, view) {
            var self = this;
            if (self.isHost()) {
                self.setViewProps(clientId, "__view", view);
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
                self.__props[clientId][key] = value;
            } else {
                // todo: rethink whether we only want to restrict host to deal with data changes, by design
                throw(new Error("Only host can call setViewProps"));
            }
            return self;
        };

    MPGameObject.prototype.getSubView =
        function MPGameObjectGetSubView(subView, props) {
            var self = this;

            props = props || (self.__props && self.__props[self.clientId]);

            if (typeof self.__plugins[subView] !== 'undefined') {
                var it = self.__plugins[subView];
                var view;

                if (typeof props[subView]['__view'] !== 'undefined') {
                    view = it.__setView(it.clientId,
                                        props[subView]['__view'],
                                        props[subView],
                                        false);
                } else {
                    view = false;
                }
                return view;
            } else {
                var splits = getFirstNamespace(subView);
                var namespace = splits[0];

                if (namespace === false || typeof self.__plugins[namespace] === 'undefined') {
                    throw(new Error("Variable ["+variable+"] does not exists"));
                } else {
                    return self.__plugins[namespace].getSubView(splits[1], props[namespace]);
                }
            }
        };

    MPGameObject.prototype.deleteViewProps =
        function MPGameObjectDeleteViewProps(clientId, key) {
            var self = this;
            delete self.__props[clientId][key];
            return self;
        };

    MPGameObject.prototype.playersForEach =
        function MPGameObjectPlayersForEach(fn) {
            var self = this;
            if (!self.isHost()) {
                throw(new Error("Only host can call playersForEach"));
            }

            if (self.__parent) {
                self.__parent.playersForEach(fn);
            } else {
                self.clients.forEach(fn);
            }

            return self;
        }

    MPGameObject.prototype.playersCount =
        function MPGameObjectPlayersCount() {
            var self = this;
            if (!self.isHost()) {
                throw(new Error("Only host can call playersCount"));
            }

            if (self.__parent) {
                return self.__parent.playersCount();
            } else {
                return self.clients.length;
            }

        };

    ///
    /// Sugars for gameObject (probably will be exposed)
    ///

    MPGameObject.prototype.getPlayersData =
        function MPGameObjectGetPlayersData(variable, cb) {
            var self = this;

            if (!self.isHost()) {
                throw(new Error("Invalid call: only host can accumulate all players data"));
            }

            var cnter = self.clients.length;
            var accumulatedResults = {};

            self.clients.forEach(function(client) {
                accumulatedResults[client] = self.getPlayerData(client, variable);
            });

            return accumulatedResults;
        };


    // Make promises function for async functions
    var _toQ = ['__setView'];
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


    ///
    /// Helper Methods
    ///

    /**
     * Sets up the object that will be passed to the rule (views and methods)
     *  so that the rule can augment gamestates. Exposes methods such as getData, setData etc.
     */
    function SetUpMethods(methods, isHost, gameObj) {
        var obj = {};

        function hostMethodWrapper(method) {
            return function() {
                return gameObj.__execMethod(gameObj.clientId, method, arguments);
            };
        }
        function hostExposedMethodWrapper(method) {
            return function() {
                return gameObj[method].apply(gameObj, arguments);
            }
        }

        function clientMethodWrapper(method) {
            return function() {
                return gameObj.__dxc.execMethod(gameObj.clientId, method, arguments);
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

        obj['getSubView'] = hostExposedMethodWrapper('getSubView');

        if (isHost) {
            // todo: views shouldn't be given methods below, even on host
            // Expose methods
            var _exposed = ['getData', 'setData',
                            'getPlayerData', 'setPlayerData', 'getPlayersData',
                            'setView', 'setViewProps', 'deleteViewProps',
                            'playersForEach', 'playersCount'];
            _exposed.forEach(function(method) {
                obj[method] = hostExposedMethodWrapper(method);
            });

        }

        obj.clientId = gameObj.clientId;
        obj.roomId = gameObj.roomId;

        return obj;
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

    /**
     * Extract out the first namespace
     * e.g "Lobby"_Apple_Car -> "Lobby"
     */
    function getFirstNamespace(variable) {
        var s = variable.split('_');
        if (s.length === 0) {
            return [false, variable];
        } else {
            var namespace = s[0];
            return [namespace, s.slice(1, s.length).join("_")];
        }
    }

    function getLastNamespace(variable) {
        var s = variable.split('_');
        if (s.length === 0) {
            return false;
        } else {
            return s[s.length - 1];
        }
    }

    /**
     * Callback function wrapper
     */
    function safeCb(cb) {
        if (isFunction(cb)) {
            return cb;
        } else {
            return function(err, res) {
                if (err) {
                    throw(err);
                } else {
                    return res;
                }
            };
        }
    }

    return MPGameObject;
})();
