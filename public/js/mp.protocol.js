// todo: rename. protocol is not the right name

var MPProtocol =
(function() {
    var Events = ['join-room', 'leave-room', 'message', 'error'];

    function MPProtocol(io, uri) {
        var self = this;

        var meshObj = new Mesh(io, uri);
        var roomId = false, clientId = false;
        var isHost = false;
        var host = null;

        meshObj.on('join-room', function(data) {
            if (isHost === true) {
                meshObj.send(data.message, {
                    type: 'host',
                    message: host
                });
            }

            self.emit('join-room', data);
        });

        meshObj.on('leave-room', function(data) {
            self.emit('leave-room', data);
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
            }
        });

        self.create =
            function MPProtocolCreate(cb) {
                meshObj.create(function(err, data) {
                    if (err) {
                        if (isFunction(cb)) {
                            cb(err, false);
                        } else {
                            throw err;
                        }
                    }

                    roomId = data.roomId;
                    clientId = data.clientId;
                    isHost = true;
                    host = clientId;
                    cb.call(self, null, data);
                });
            };

        self.join =
            function MPProtocolJoin(rid, cb) {
                meshObj.join(rid, function(err, data) {
                    if (err) {
                        if (isFunction(cb)) {
                            cb(err, false);
                        } else {
                            throw err;
                        }
                    }

                    roomId = rid;
                    clientId = data.clientId;
                    isHost = false;
                    cb.call(self, null, data);
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
