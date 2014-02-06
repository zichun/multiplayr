var MPProtocol =
(function() {
    function MPProtocol(io, uri) {
        var self = this;

        var meshObj = new Mesh(io, uri);
        var roomId = false, clientId = false;
        var isHost = false;
        var host = null;


        meshObj.on('join-room', function(data) {
        });

        meshObj.on('leave-room', function(data) {
        });

        meshObj.on('message', function(data) {
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
            function MPProtocolSendToHost(message, cb) {
                if (host === null) {
                    // todo: to differ/buffer message and send when host is resolved
                    throw new Error("Have not resolved host");
                }
                meshObj.send(host, message, cb);
            };

        self.broadcast =
            function MPProtocolBroadcast(clientId, message, cb) {
                if (!isHost) {
                    throw new Error("Only host can broadcast");
                }
                // todo: implement with proper callback
            };
        self.send =
            function MPProtocolSend(clientId, message, cb) {
                if (!isHost) {
                    throw new Error("Only host can send messages");
                }
                meshObj.send(clientId, message, cb);
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

    return MPProtocol;
})();
