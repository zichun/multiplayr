function Player(_opt) {

    // todo: player number to persist? to be set as an option

    function PlayerCollection(players, hostObj) {
        var self = this;

        self.size = function() {
            return players.length;
        };

        self.getId = function() {
            var tr = [];
            players.forEach(function(playerId) {
                tr.push(playerId);
            });
            return tr.length === 1 ? tr[0] : tr;
        };

        self.setView = function(view, data, cb){
            var self = this;
            // todo: proper async and callback
            players.forEach(function(playerId) {
                hostObj.clientSetView(playerId, view, data);
            });
            return self;
        };

        self.sendMessage = function(type, message, cb) {
            var self = this;
            // todo: proper async and callback
            players.forEach(function(playerId) {
                hostObj.sendMessage(type, message);
            });
            return self;
        };

        self.get = function(ind) {
            if (typeof ind !== 'number' || ind < 0 || ind > players.length) {
                throw (new Error("Invalid arg"));
            } else {
                return new PlayerCollection([players[ind]]);
            }
        };

        self.slice = function(start, end) {
            return new PlayerCollection(players.slice(start, end));
        };

        self.data = function(dataName, data) {
            var self = this;
            if (typeof data === 'undefined') {
                // getter
                var tr = [];
                players.forEach(function(playerId) {
                    tr.push(hostObj.getDataSync(playerId, dataName));
                });
                return tr;
            } else {
                // setter
                players.forEach(function(playerId) {
                    hostObj.setData(playerId, dataName, data);
                });
                return self;
            }
        };

        return self;
    }

    return function() {
        var self = this;
        self.defineHost(function(hostRule) {

            hostRule.on('load', function() {
                var hostObj = this;
                hostObj._player = {
                    players: []
                };
            });

            hostRule.on('client-join', function(data) {
                var hostObj = this;
                hostObj._player.players.push(data.client);
            });

            hostRule.on('client-leave', function(data) {
                var hostObj = this;
                hostObj._player.players.splice(hostObj._player.players.indexOf(data.client));
            });

            hostRule.methods.player = function(num) {
                var hostObj = this;
                var players = [];

                num = num || [0, hostObj.playerCount() - 1];

                if (typeof num === 'string') {
                    var ind = hostObj._player.players.indexOf(num);
                    if (ind === -1) {
                        return new PlayerCollection([], hostObj);
                    }
                    num = [ind, ind];
                } else if (!isArray(num)) {
                    num = [parseInt(num, 10), parseInt(num, 10)];
                }
                if (num.length !== 2 || num[1] < num[0]) {
                    throw(new Error("Invalid arg"));
                }

                for (var i=num[0];i<=num[1];++i) {
                    if (i >= 0 && i < hostObj._player.players.length) {
                        players.push(hostObj._player.players[i]);
                    }
                }

                return new PlayerCollection(players, hostObj);
            };

            hostRule.methods.playerCount = function() {
                var hostObj = this;
                return hostObj._player.players.length;
            };

            hostRule.methods.playerForEach = function(fn) {
                var hostObj = this;
                for (var i in hostObj._player.playerName) {
                    if (hostObj._player.playerName.hasOwnProperty(i)) {
                        fn.call(hostObj._player.playerName, i);
                    }
                }
            };

        });
    };
}
