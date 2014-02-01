// todo: make all function async for future proofing

var func = require('inc.js');

//
// Room Class
// @arg roomId  Unique Identifier of room
//
function Room(roomId) {
    this.id = roomId;
    this.clients = [];
    this.clientSockets = {};
}

Room.prototype.addClient =
    // Add Client to Room
    // @arg clientId Unique Id of client
    // @arg socket The socket.io object of the new client
    function RoomAddClient(clientId, socket) {
        this.clients.push(clientId);
        this.clientSockets[clientId] = socket;
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

        delete this.clients[index];
        delete this.clientSockets[clientId];

        return this.clients.length;
    };

Room.prototype.broadcast =
    // (async)
    // Broadcast message to room
    // @arg message Message to send
    // @arg cb Callback function
    function RoomBroadcast(message, cb) {

        this.clients.forEach(function(node) {
            this.clientSockets[node].emit('room-broadcast', message);
        });

        // todo: proper callback
        cb(true, 'ok');
    };

Room.prototype.getClients =
    function RoomGetClients() {
        var tr = [];
        this.clients.forEach(function(client) {
            tr.push(client);
        });
        return client;
    };

//
// Rooms Manager
//
function Rooms() {
    this.rooms = {};
    this.clientsRoomMap = {};

    return this;
}

Rooms.prototype.create =
    function RoomsCreateRoom(socket) {
        var self = this;
        var uniqid = false, clientId = false;

        do {
            uniqid = func.uniqid('mp-room-');
        } while(self.rooms[uniqid]);

        clientId = func.uniqid('mp-client-', true);

        self.rooms[uniqid] = new Room(uniqid);
        self.rooms[uniqid].addClient(clientId, socket);

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

Rooms.prototype.removeClient =
    // Remove a given client from the room management
    // @arg clientId Identifier of client
    function RoomsRemoveClient(clientId) {
        var self = this;

        if (!self.clientsRoomMap[clientId]) {
            throw(new Error("Client Id does not exist"));
        }

        var roomId = self.getClientRoom(clientId);
        var clientsLeft = self.rooms[roomId].removeClient(clientId);

        if (clientsLeft === false) {
            return false;
        } else if (clientsLeft === 0) {
            // GC
            delete self.rooms[roomId];
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

Rooms.prototype.addClient =
    function RoomsAddClient(room, socket) {
        var self = this;
        var clientId = false;

        if (self.hasRoom(room)) {
            clientId = func.uniqid('mp-client-', true);
            self.rooms[room].addClient(clientId, socket);
            return clientId;
        } else {
            throw(new Error('Room does not exists'));
        }
    };

Rooms.prototype.broadcast =
    // (Async)
    // Broadcast a message to a particular room
    // @arg room Name of room
    // @arg message Message to broadcast
    // @arg cb Callback function
    function RoomsBroadcast(room, message, cb) {
        var self = this;

        if (self.hasRoom(room)) {
            self.rooms(room).broadcast(message, cb);
        } else {
            cb(false, 'Room does not exists');
        }
    };
