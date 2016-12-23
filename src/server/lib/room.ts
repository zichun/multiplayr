// todo: make all function async for future proofing

//
// Room Class
// @arg roomId  Unique Identifier of room
//
class Room {
    id: string;
    clients: Array<string>;
    clientSockets: {[key: string]: any};
    clientActiveMap: {[key: string]: boolean};
    rule: string;

    constructor(roomId, rule) {
        this.id = roomId;
        this.clients = [];
        this.clientSockets = {};
        this.clientActiveMap = {};
        this.rule = rule;
    }

    sendMessage(to, type, message, cb?) {
        var self = this;

        if (!self.hasClient(to)) {
            return cb && cb('Invalid receipient', false);
        } else {
            this.clientSockets[to].emit(type, message);
            return cb && cb(null, true);
            // todo: proper callback bound to emit
        }
    }

    // (async)
    // Send Messages from a client
    clientSendMessage(from, to, message, cb?) {
        var self = this;

        if (!self.hasClient(from) || !self.hasClient(to)) {
            cb && cb('Invalid sender / receipient', false);
        } else {
            self.sendMessage(to,
                             'client-sendmessage',
                             {
                                 from: from,
                                 message: message
                             },
                             cb);
        }
    }

    hasClient(clientId) {
        return this.clients.indexOf(clientId) >= 0;
    }

    // Add Client to Room
    // @arg clientId Unique Id of client
    // @arg socket The socket.io object of the new client
    addClient(clientId, socket) {
        var self = this;

        if (self.hasClient(clientId)) {
            return false;
        }

        self.clients.push(clientId);
        self.clientSockets[clientId] = socket;
        self.clientActiveMap[clientId] = true;

        self.broadcast('join-room', clientId, function() {
            self.sendMessage(clientId,
                             'room-rule',
                             {
                                 from: null,
                                 message: self.rule
                             });
        });

        return true;
    }

    // Reconnect a client back to the room
    // @arg clientId Unique Id of client
    // @arg socket The socket.io object of the new client
    // @arg socketioReonnect If it's due to a socketio reconnection, no need to resend rule
    reconnectClient(clientId, socket, socketioReconnect) {
        var self = this;

        if (self.hasClient(clientId) === false) {
            return false;
        }

        self.clientActiveMap[clientId] = true;
        self.clientSockets[clientId] = socket;

        var broadcastMsg = socketioReconnect ? 'rejoin-room' : 'join-room';

        self.broadcast(broadcastMsg, clientId, function() {
            if (!socketioReconnect) {
                self.sendMessage(clientId,
                                 'room-rule',
                                 {
                                     from: null,
                                     message: self.rule
                                 });
            }
        });

        return true;
    }

    // Mark a client as disconnected. When enumerating clients (broadcast / getClient),
    // this client will be omitted, until the clientId has been reconnected.
    // @arg clientId Unique Id of client
    // @return false if client does not exists, and true otherwise.
    disconnectClient(clientId) {
        var index = this.clients.indexOf(clientId);

        if (index === -1) {
            return false;
        }

        this.clientActiveMap[clientId] = false;

        return true;
    }

    // Remove client from room
    // @arg clientId Unique Id of client
    // @return false if client does not exists, and an integer if it does indicating number of clients left
    removeClient(clientId) {
        var index = this.clients.indexOf(clientId);
        if (index === -1) {
            return false;
        }

        this.clients.splice(index, 1);
        delete this.clientSockets[clientId];

        return this.clients.length;
    }

    // (async)
    // Broadcast message to room
    // @arg type Type of message
    // @arg message Message to send
    // @arg cb Callback function
    broadcast(type, message, cb) {
        var self = this;

        for (var clientId in self.clientActiveMap) {
            if (self.clientActiveMap.hasOwnProperty(clientId) &&
                self.clientActiveMap[clientId] === true)
            {
                self.sendMessage(clientId,
                                 'room-broadcast',
                                 { type: type, message: message },
                                 function() {});
            }
        }

        // todo: proper callback
        cb(null, true);
    };

    getClients() {
        var tr = [];
        var self = this;

        for (var clientId in self.clientActiveMap) {
            if (self.clientActiveMap.hasOwnProperty(clientId) &&
                self.clientActiveMap[clientId] === true)
            {
                tr.push(clientId);
            }
        }

        return tr;
    }

    // Get all clients, including disconnected ones.
    getAllClients() {
        var tr = [];
        var self = this;

        for (var clientId in self.clientActiveMap) {
            if (self.clientActiveMap.hasOwnProperty(clientId))
            {
                tr.push(clientId);
            }
        }

        return tr;
    }

}

export = Room;
