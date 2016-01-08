// todo: rename. protocol is not the right name

var MPProtocol =
(function() {
    var Events = ['join-room', 'leave-room', 'message', 'error', 'join-game'];

    function MPProtocol(io, uri, container) {
        var self = this;

        var meshObj = new Mesh(io, uri);
        var roomId = false, clientId = false;
        var isHost = false;
        var host = null;
        var rule = false;

        meshObj.on('join-room', function(data) {
            if (isHost === true && roomId) {
                meshObj.send(data.message, {
                    type: 'host',
                    message: host
                });
            }
            self.emit('join-room', clientId);
        });

        meshObj.on('leave-room', function(data) {
            self.emit('leave-room', data.message);
        });

        meshObj.on('message', function(data) {
            // todo: determine message wrapping nomenclature
            if (data.message.type === 'host') {
                host = data.message.message;
            } else if (data.message.type === 'message') {
                self.emit('message', {
                    from: data.from,
                    message: data.message.message
                });
            } else if (data.message.type === 'join-game') {
                self.emit('join-game', data.message.message);
            }
        });

        meshObj.on('room-rule', function(data) {
            self.rule = data;

            var ruleDef = _MPRules[self.rule];
            if (typeof ruleDef === 'undefined') {
                throw(new Error("Rule " + self.rule + " does not exist!"));
            }

            function attempt() {
                if (!roomId) {
                    return setTimeout(attempt, 100);
                }

                if (isHost) {
                    Multiplayr.loadRule(ruleDef.rules, function() {
                        var rule = ruleDef.onLoad();
                        Multiplayr.host(rule, self, container);
                    });
                } else {
                    Multiplayr.loadRule(ruleDef.rules, function() {
                        var rule = ruleDef.onLoad();
                        Multiplayr.join(rule, self, container);

                        // we emit a join game to host only after initializing the game on client
                        function attempt() {
                            if (!host) {
                                return setTimeout(attempt, 500);
                            }

                            return meshObj.send(host, {
                                type: 'join-game',
                                message: clientId
                            });
                        }

                        attempt();
                    });
                }

                return 0;
            }
            attempt();
        });

        self.create =
            function MPProtocolCreate(rule, cb) {
                isHost = true;
                meshObj.create(rule, function(err, data) {
                    // todo: check rule
                    var mcb = safeCb(cb);
                    if (err) {
                        return mcb(err, false);
                    }

                    roomId = data.roomId;
                    clientId = data.clientId;
                    host = clientId;
                    mcb.call(self, null, data);

                    return self;
                });
            };

        self.join =
            function MPProtocolJoin(rid, cb) {
                isHost = false;
                meshObj.join(rid, function(err, data) {
                    var mcb = safeCb(cb);
                    if (err) {
                        return mcb(err, false);
                    }

                    roomId = rid;
                    clientId = data.clientId;
                    mcb.call(self, null, data);

                    return self;
                });
            };

        self.sendToHost =
            function MPProtocolSendToHost(data, cb) {
                if (host === null) {
                    // todo: to differ/buffer message and send when host is resolved
                    throw new Error("Have not resolved host");
                }

                meshObj.send(host, {
                    type: 'message',
                    message: data
                }, cb);

                return self;
            };

        self.broadcast =
            function MPProtocolBroadcast(clientId, message, cb) {
                if (!isHost) {
                    throw new Error("Only host can broadcast");
                }
                // todo: implement with proper callback
            };

        self.send =
            function MPProtocolSend(clientId, data, cb) {
                // if (!isHost) {
                //     throw new Error("Only host can send messages");
                // }
                meshObj.send(clientId, {
                    type: 'message',
                    message: data
                }, cb);

                return self;
            };

        self.getHost =
            function MPProtocolGetHostId() {
                return host;
            };

        self.getRoomId =
            function MPProtocolGetRoomId() {
                return roomId;
            };

        self.getClientId =
            function MPProtocolGetClientId() {
                return clientId;
            };

        return self;
    }

    setupEventSystem(MPProtocol, Events);

    return MPProtocol;
})();
