var MPGameEngine = (function(){

function MPGameEngine(ruleObj, container, io, uri) {
    var self = this;

    self.mesh = new Mesh(io, uri);
    self.container = container;
    self.playerObj = null;
    self.ruleObj = ruleObj;

    return self;
}

MPGameEngine.prototype.host =
    function MPGameEngineHost(cb) {
        var self = this;
        self.mesh.create(function(err, data) {
            if (err) {
                if (isFunction(cb)) {
                    cb(err, false);
                } else {
                    throw new Error(err);
                }
            }

            self.mesh.on('message', function(data) {
                var from = data.from;
                var message = data.message;

                self.ruleObj.hostRule.emit('message', {
                    from: from,
                    type: message.type,
                    message: message.message
                }, self.playerObj);
            });

            self.mesh.on('join-room', function(data) {
                self.ruleObj.hostRule.emit('client-join', {
                    // todo: unify API naming to be more consistent
                    client: data.message
                }, self.playerObj);
            });

            self.mesh.on('leave-room', function() {
                self.ruleObj.hostRule.emit('client-leave', {
                    // todo: unify API naming to be more consistent
                    client: data.message
                }, self.playerObj);
            });

            self.playerObj = new MPPlayer(self, self.ruleObj.hostRule, self.ruleObj, self.container);
            self.playerObj.init();

            if (isFunction(cb)) {
                cb(null, self.playerObj);
            }
        });
    };

MPGameEngine.prototype.sendToHost =
    function MPGameEngineSendToHost(type, message, cb) {
        var self = this;

        // todo: check if object is properly initialized
        // todo: need a proper protocol layer that cognizes the notion of a "host"
        self.mesh.send(
            self.mesh.peers[0],
            {
                type: type,
                message: message
            },
            cb);
    };

MPGameEngine.prototype.send =
    function MPGameEngineSend(player, type, message) {
        // todo: implement
    };


MPGameEngine.prototype.join =
    function MPGameEngineJoin(roomId, cb) {
        var self = this;
        self.mesh.join(roomId, function(err, data) {
            if (err) {
                if (isFunction(cb)) {
                    cb(err, false);
                } else {
                    throw new Error(err);
                }
            }

//            self.mesh.on('message', function(data) {
//                alert(data);
//            });

            self.playerObj = new MPPlayer(self, self.ruleObj.clientRule, self.ruleObj, self.container);
            self.playerObj.init();

            if (isFunction(cb)) {
                cb(null, self.playerObj);
            }
        });
    };


    return MPGameEngine;
})();
