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

        self._dataPortal = SetUpData(data);

        return self;
    }

    function SetUpData(dataObj) {
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
                throw(new Error("Only host has access to player data"));
            }
            self.dxc.getData(playerId, variable, cb);
            return self;
        };

    MPGameObject.prototype.setPlayerData =
        function MPGameObjectSetPlayerData(playerId, variable, value, cb) {
            var self = this;
            if (self.isHost() === false) {
                throw(new Error("Only host has access to player data"));
            }
            self.dxc.getData(playerId, variable, value, cb);
            return self;
        };

    MPGameObject.prototype.setLocalData =
        function MPGameObjectSetLocalData(variable, value, cb) {
            var self = this;
            try {
                cb(null, self._dataPortal(_secret, variable).set(value));
            } catch(e) {
                cb(e, false);
            }
            return self;
        };

    MPGameObject.prototype.getLocalData =
        function MPGameObjectGetLocalData(variable, cb) {
            var self = this;
            try {
                cb(null, self._dataPortal(_secret, variable).get());
            } catch(e) {
                cb(e, false);
            }
            return self;
        };

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


    return MPGameObject;
})();