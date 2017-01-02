var Mesh =
(function() {
    // todo: (low priority) proper encapsulation of private data like self.peers, self.socket etc.

    var Events = ['join-room', 'leave-room', 'message', 'room-broadcast', 'error', 'room-rule', 'rejoin-room'];

    function Mesh(io, uri) {
        var self = this;
        var socket = self.socket = io.connect(uri,
                                              { 'reconnect': true,
                                                'reconnection delay': 200,
                                                'force new connection': true
                                              });

        self.peers = [];
        self.roomId = null;
        self.clientId = null;

        socket.on('reconnect', function(data) {
            if (self.clientId === null || self.roomId === null) {
                throw(new Error('Reconnection without clientId'));
            }

            socket.emit('rejoin-room',
                        {
                            roomId: self.roomId,
                            clientId: self.clientId
                        },
                        function(data) {

                            if (data.messageType === 'error') {
                                return self.emit('error', data);
                            }

                            self.refreshClients();
                        });
        });

        socket.on('client-sendmessage', function(data) {
            self.emit('message', data);
        });

        socket.on('room-broadcast', function(data) {
            switch(data.messageType) {
            case 'rejoin-room':
                self.emit('rejoin-room', data);
                break;
            case 'join-room':
                self.emit('join-room', data);
                break;
            case 'leave-room':
                self.emit('leave-room', data);
                break;
            default:
                self.emit('room-broadcast', data);
                break;
            }
        });

        socket.on('room-rule', function(data) {
            self.emit('room-rule', data.message);
        });

        self.on('join-room', function(data) {
            self.peers.push(data.message);
        });

        self.on('leave-room', function(data) {
            var ind = self.peers.indexOf(data.message);
            if (ind >= 0) {
                self.peers.splice(ind, 1);
            }
        });

        self.on('error', function(data) {
            console.log('Error: ' + data.message);
        });

        return this;
    }

    Mesh.prototype.create =
        function MeshCreate(rule, cb) {
            var self = this;
            if (self.roomId !== null) {
                throw(new Error("Client already belong to a Mesh"));
            }

            self.socket.emit('create-room', {rule: rule}, function(data) {
                if (data.messageType === 'error') {
                    if (isFunction(cb)) cb(data.message, data);
                    return self.emit('error', data);
                }

                self.roomId = data.roomId;
                self.clientId = data.clientId;

                if (isFunction(cb)) {
                    cb(null, data);
                }

                return self;
            });
        };

    Mesh.prototype.refreshClients =
        function MeshRefreshClients() {
            var self = this;
            // Get connected peers
            self.socket.emit('room-clients', {}, function(data) {
                if (data.messageType === 'error') {
                    return self.emit('error', data);
                } else {
                    self.updatePeers(data);
                }
            });
        };

    Mesh.prototype.join =
        function MeshJoin(roomId, clientId, cb) {
            var self = this;

            if (self.roomId !== null || self.clientId !== null) {
                throw(new Error("Client already belong to a Mesh"));
            }

            console.log('Joining room[' + roomId + '] as client[' + clientId + ']');

            self.socket.emit('join-room',
                             {
                                 roomId: roomId,
                                 clientId: clientId
                             },
                             function(data) {
                                 if (data.messageType === 'error') {
                                     if (isFunction(cb)) cb(data.message, data);
                                     return self.emit('error', data);
                                 }

                                 self.roomId = data.roomId;
                                 self.clientId = data.clientId;

                                 self.refreshClients();

                                 if (isFunction(cb)) {
                                     cb(null, data);
                                 }

                                 return self;
                             });
        };

    Mesh.prototype.hasRoom =
        function MeshHasRoom(roomId, cb) {
            var self = this;
            self.socket.emit('has-room',
                             {
                                 roomId: roomId
                             },
                             function(data) {
                                 if (data.messageType === 'error') {
                                     if (isFunction(cb)) cb(data.message, data);
                                     return self.emit('error', data);
                                 }

                                 if (isFunction(cb)) {
                                     return cb(null, data);
                                 }
                             });
        };

    Mesh.prototype.updatePeers =
        function MeshUpdatePeers(peers) {
            var self = this;
            peers.forEach(function(peer) {
                if (self.peers.indexOf(peer) === -1) {
                    self.peers.push(peer);
                }
            });

            return self;
        };

    Mesh.prototype.send =
        function MeshSend(clientId, message, cb) {
            var self = this;
            if (self.roomId === null) {
                throw(new Error("Client does not belong to a Mesh. Call create or join"));
            }

            self.socket.emit('send-message',
                             {
                                 message: message,
                                 toClientId: clientId
                             },
                             function(data) {
                                 if (data.messageType === 'error') {
                                     if (isFunction(cb)) {
                                         cb(data.message, data);
                                     }
                                     self.emit('error', data);
                                     return;
                                 }
                                 if (isFunction(cb)) {
                                     cb(null, data);
                                 }
                             });

            return self;
        };

    setupEventSystem(Mesh, Events);

    return Mesh;
})();
