var Mesh =
(function() {
    // todo: (low priority) proper encapsulation of private data like self.peers, self.socket etc.

    var Events = ['join-room', 'leave-room', 'message', 'room-broadcast', 'error'];

    function isFunction(functionToCheck) {
        var getType = {};
        return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
    }

    function Mesh(io, uri) {
        var self = this;
        var socket = self.socket = io.connect(uri, {'force new connection': true});

        self.peers = [];
        self.roomId = null;
        self.clientId = null;

        self.eventBindings = {};
        Events.forEach(function(evt) {
            self.eventBindings[evt] = [];
        });

        socket.on('client-sendmessage', function(data) {
            self.emit('message', data);
        });

        socket.on('room-broadcast', function(data) {
            switch(data.type) {
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
        function MeshCreate(cb) {
            var self = this;
            if (self.roomId !== null) {
                throw(new Error("Client already belong to a Mesh"));
            }

            self.socket.emit('create-room', {}, function(data) {
                if (data.type === 'error') {
                    if (isFunction(cb)) cb(data.message, data);
                    return self.emit('error', data);
                }

                self.roomId = data.roomId;
                self.clientId = data.clientId;

                if (isFunction(cb)) {
                    cb(null, data);
                }
            });
        };

    Mesh.prototype.join =
        function MeshJoin(id, cb) {
            var self = this;
            if (self.roomId !== null) {
                throw(new Error("Client already belong to a Mesh"));
            }
            self.socket.emit('join-room', {room: id}, function(data) {
                if (data.type === 'error') {
                    if (isFunction(cb)) cb(data.message, data);
                    return self.emit('error', data);
                }

                self.roomId = data.roomId;
                self.clientId = data.clientId;
                // Get connected peers
                self.socket.emit('room-clients', {}, function(data) {
                    if (data.type === 'error') {
                        return self.emit('error', data);
                    } else {
                        self.updatePeers(data);
                    }
                });

                if (isFunction(cb)) {
                    cb(null, data);
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
                                 to: clientId
                             },
                             function(data) {
                                 if (data.type === 'error') {
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
        };

    Mesh.prototype.on =
        function MeshOn(evt, callback) {
            var self = this;
            if (Events.indexOf(evt) === -1) {
                throw(new Error("Invalid event: " + evt));
            } else if (!isFunction(callback)) {
                throw(new Error("Invalid callback argument"));
            } else {
                self.eventBindings[evt].push(callback);
            }
        };

    Mesh.prototype.off =
        function MeshOff(evt, callback) {
            var self = this;
            if (Events.indexOf(evt) === -1) {
                throw(new Error("Invalid event: " + evt));
            } else {
                var ind = self.eventBindings[evt].indexOf(callback);
                if (ind >= 0) {
                    self.eventBindings[evt].splice(ind, 1);
                }
            }
        };

    Mesh.prototype.emit =
        function MeshEmit(evt, data) {
            var self = this;

            if (Events.indexOf(evt) === -1) {
                throw(new Error("Invalid event: " + evt));
            } else {
                self.eventBindings[evt].forEach(function(cb) {
                    cb.call(self, data);
                });
            }
        };

    return Mesh;
})();
