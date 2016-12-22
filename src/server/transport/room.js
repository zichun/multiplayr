// todo: make all function async for future proofing

var func = require('./inc.js');

var roomInactiveLifespan = 60 * 60 * 1000; // 1 hour

//
// Room Class
// @arg roomId  Unique Identifier of room
//
function Room(roomId, rule) {
    this.id = roomId;
    this.clients = [];
    this.clientSockets = {};
    this.clientActiveMap = {};
    this.rule = rule;
}

Room.prototype.sendMessage =
    function RoomSendMessage(to, type, message, cb) {
        var self = this;
        if (!self.hasClient(to)) {
            return cb && cb('Invalid receipient', false);
        } else {
            this.clientSockets[to].emit(type, message);
            return cb && cb(null, true);
            // todo: proper callback bound to emit
        }
    };

Room.prototype.clientSendMessage =
    // (async)
    // Send Messages from a client
    function RoomClientSendMessage(from, to, message, cb) {
        var self = this;

        if (!self.hasClient(from) || !self.hasClient(to)) {
            cb('Invalid sender / receipient', false);
        } else {
            self.sendMessage(to,
                             'client-sendmessage',
                             {
                                 from: from,
                                 message: message
                             },
                             cb);
        }
    };

Room.prototype.hasClient =
    function RoomHasClient(clientId) {
        return this.clients.indexOf(clientId) >= 0;
    };

Room.prototype.addClient =
    // Add Client to Room
    // @arg clientId Unique Id of client
    // @arg socket The socket.io object of the new client
    function RoomAddClient(clientId, socket) {
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
    };

Room.prototype.reconnectClient =
    // Reconnect a client back to the room
    // @arg clientId Unique Id of client
    // @arg socket The socket.io object of the new client
    // @arg socketioReonnect If it's due to a socketio reconnection, no need to resend rule
    function RoomReconnectClient(clientId, socket, socketioReconnect) {
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
    };

Room.prototype.disconnectClient =
    // Mark a client as disconnected. When enumerating clients (broadcast / getClient),
    // this client will be omitted, until the clientId has been reconnected.
    // @arg clientId Unique Id of client
    // @return false if client does not exists, and true otherwise.
    function RoomDisconnectClient(clientId) {
        var index = this.clients.indexOf(clientId);

        if (index === -1) {
            return false;
        }

        this.clientActiveMap[clientId] = false;

        return true;
    };

Room.prototype.removeClient =
    // Remove client from room
    // @arg clientId Unique Id of client
    // @return false if client does not exists, and an integer if it does indicating number of clients left
    function RoomRemoveClient(clientId) {
        var index = this.clients.indexOf(clientId);
        if (index === -1) {
            return false;
        }

        this.clients.splice(index, 1);
        delete this.clientSockets[clientId];

        return this.clients.length;
    };

Room.prototype.broadcast =
    // (async)
    // Broadcast message to room
    // @arg type Type of message
    // @arg message Message to send
    // @arg cb Callback function
    function RoomBroadcast(type, message, cb) {
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

Room.prototype.getClients =
    function RoomGetClients() {
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
    };

Room.prototype.getAllClients =
    // Get all clients, including disconnected ones.
    function RoomGetAllClients() {
        var tr = [];
        var self = this;

        for (var clientId in self.clientActiveMap) {
            if (self.clientActiveMap.hasOwnProperty(clientId))
            {
                tr.push(clientId);
            }
        }

        return tr;
    };

//
// Rooms Manager
//
function Rooms() {
    this.rooms = {};
    this.clientsRoomMap = {};
    this.roomCleanupTimer = {};

    return this;
}

Rooms.prototype.create =
    function RoomsCreateRoom(socket, rule) {
        var self = this;
        var uniqid = false, clientId = false;

        do {
            uniqid = func.randomRoomId();
        } while(self.rooms[uniqid]);

        clientId = func.uniqid('mp-client-', true);

        self.rooms[uniqid] = new Room(uniqid, rule);
        self.rooms[uniqid].addClient(clientId, socket, false);

        self.clientsRoomMap[clientId] = uniqid;

        return {
            "roomId": uniqid,
            "clientId": clientId
        };
    };

Rooms.prototype.hasRoom =
    function RoomsHasRoom(room) {
        var self = this;
        for (var rooms in self.rooms) {
            if (self.rooms.hasOwnProperty(rooms) && rooms === room) {
                return true;
            }
        }
        return false;
    };

Rooms.prototype.getClientRoom =
    function RoomsGetClientRoom(clientId) {
        var self = this;

        if (!self.clientsRoomMap[clientId]) {
            throw(new Error("Client Id does not exist"));
        }
        return self.clientsRoomMap[clientId];
    };

Rooms.prototype.deleteRoom =
    function RoomsDeleteRoom(roomId) {
        console.log('Deleting Room[' + roomId + ']');

        var self = this;
        var clients = self.rooms[roomId].getAllClients();

        for (var i = 0; i < clients.length; ++i) {
            if (self.clientsRoomMap.hasOwnProperty(clients[i])) {
                delete self.clientsRoomMap[clients[i]];
            }
        }

        delete self.rooms[roomId];
        delete self.roomCleanupTimer[roomId];
    };

Rooms.prototype.unmarkRoomForCleanup =
    function RoomsUnmarkRoomForCleanup(roomId) {
        var self = this;

        if (self.hasRoom(roomId) === false) {
            throw(new Error("Room " + roomId + " does not exists."));
        }

        if (self.roomCleanupTimer.hasOwnProperty(roomId)) {
            clearTimeout(self.roomCleanupTimer[roomId]);
            delete self.roomCleanupTimer[roomId];

            return true;
        }

        return false;
    };

Rooms.prototype.markRoomForCleanup =
    // Start a timer to mark the room for cleanup.
    // Whenever a new client joins, reset this timer.
    function RoomsMarkRoomForCleanup(roomId) {
        var self = this;

        if (self.hasRoom(roomId) === false) {
            throw(new Error("Room " + roomId + " does not exists."));
        }

        if (!self.roomCleanupTimer[roomId]) {
            console.log("Marking " + roomId + " for deletion");
            self.roomCleanupTimer[roomId] = setTimeout(function() {
                self.deleteRoom(roomId);
            }, roomInactiveLifespan);
        }
        return self.roomCleanupTimer[roomId];
    };

Rooms.prototype.disconnectClient =
    // Disconnect a given client from the room management
    // @arg clientId Identifier of client
    function RoomsDisconnectClient(clientId) {
        var self = this;

        if (!self.clientsRoomMap[clientId]) {
            throw(new Error("Client Id does not exist"));
        }

        var roomId = self.getClientRoom(clientId);

        console.log('Client[' + clientId + '] disconnected from Room[' + roomId + ']');

        self.rooms[roomId].disconnectClient(clientId);
        self.rooms[roomId].broadcast('leave-room',
                                     clientId,
                                     function() {});

        if (self.rooms[roomId].getClients().length === 0) {
            self.markRoomForCleanup(roomId);
        }
    };

Rooms.prototype.removeClient =
    // Remove a given client from the room management. When client count hits 0, garbage collect room.
    // @arg clientId Identifier of client
    function RoomsRemoveClient(clientId) {
        var self = this;

        if (!self.clientsRoomMap[clientId]) {
            throw(new Error("Client Id does not exist"));
        }

        var roomId = self.getClientRoom(clientId);
        var clientsLeft = self.rooms[roomId].removeClient(clientId);

        delete self.clientsRoomMap[clientId];

        self.rooms[roomId].broadcast('leave-room', clientId, function() {});

        if (clientsLeft === false) {
            return false;
        } else if (clientsLeft === 0) {
            self.deleteRoom(roomId);
        }
    };

Rooms.prototype.getRooms =
    function RoomsGetRooms() {
        var self = this;
        var tr = [];

        for (var rooms in self.rooms) {
            if (self.rooms.hasOwnProperty(rooms)) {
                tr.push(rooms);
            }
        }

        return rooms;
    };

Rooms.prototype.getClients =
    function RoomsGetClient(room) {
        var self = this;

        if (self.hasRoom(room)) {
            return self.rooms[room].getClients();
        } else {
            throw(new Error('Room does not exists'));
        }
    };

Rooms.prototype.reconnectClient =
    function RoomsReconnectClient(room, socket, clientId, socketioReconnect) {
        var self = this;
        if (self.hasRoom(room) && self.clientsRoomMap[clientId] === room) {

            console.log('Client[' + clientId + '] reconnecting to Room[' + room + ']');

            var result = self.rooms[room].reconnectClient(clientId, socket, socketioReconnect);

            if (result) {
                self.unmarkRoomForCleanup(room);
            }

            return result;
        } else {
            throw(new Error('Room does not exists'));
        }
    };

Rooms.prototype.addClient =
    function RoomsAddClient(room, socket) {
        var self = this;
        var clientId = false;

        if (self.hasRoom(room)) {
            clientId = func.uniqid('mp-client-', true);
            self.rooms[room].addClient(clientId, socket);
            self.clientsRoomMap[clientId] = room;

            console.log('Client[' + clientId + '] joining Room[' + room + ']');

            self.unmarkRoomForCleanup(room);

            return clientId;
        } else {
            throw(new Error('Room does not exists'));
        }
    };

/*Rooms.prototype.broadcast =
    // (Async)
    // Broadcast a message to a particular room
    // @arg room Name of room
    // @arg message Message to broadcast
    // @arg cb Callback function
    function RoomsBroadcast(room, message, cb) {
        var self = this;

        if (self.hasRoom(room)) {
            self.rooms[room].broadcast(message, cb);
        } else {
            cb('Room does not exists', false);
        }
    };*/

Rooms.prototype.sendMessage =
    function RoomsSendMessage(room, from, to, message, cb) {
        var self = this;

        if (self.hasRoom(room)) {
            self.rooms[room].clientSendMessage(from, to, message, cb);
        } else {
            cb('Room does not exists', false);
        }
    };

module.exports = Rooms;
