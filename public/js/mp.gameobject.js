var MPGameObject = (function() {
    var _secret = {};

    function MPGameObject(opt) {
        var self = this;
        var data = opt.data;

        self.roomId = opt.roomId;
        self.clientId = opt.clientId;
        self.container = opt.contaienr || document.body;

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
                    return dataObj[variable].type.setter.call(_store[variable], newValue);
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
        function MPGameObjectGetPlayerData(playerId, data, cb) {
            var self = this;
            if (self.isHost() === false) {
                throw(new Error("Only host has access to player data"));
            }
            throw(new Error("Not implemented"));
        };

    MPGameObject.prototype.setPlayerData =
        function MPGameObjectSetPlayerData(playerId, data, cb) {
            if (self.isHost() === false) {
                throw(new Error("Only host has access to player data"));
            }
            throw(new Error("Not implemented"));
        };

    MPGameObject.prototype.getData =
        function MPGameObjectGetData(data, cb) {
            var self = this;
            if (self.isHost()) {
                // Current scope is host, and so data belongs to self
                cb(self._dataPortal(_secret, data).get());
            } else {
                // create a data proxy
                throw(new Error("Not implemented"));
            }
        };

    MPGameObject.prototype.setData =
        function MPGameObjectSetData(data, cb) {
            throw(new Error("Not implemented"));
        };


    return MPGameObject;
})();