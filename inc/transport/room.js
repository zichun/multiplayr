var func = require('inc.js');


//
// Room Class
// @arg socket  The socket.io object of the host
//
function Room(socket) {
    this.host = socket;
    this.clients = [];
}

Room.prototype.addClient =
    // Add Client to Room
    // @arg socket The socket.io object of the new client
    function RoomAddClient(socket) {
        this.clients.push(socket);
        return true;
    };

Room.prototype.broadcast =
    // (async)
    // Broadcast message to room
    // @arg message Message to send
    // @arg cb Callback function
    function RoomBroadcast(message, cb) {
        function todo(node) {
            node.emit('room-broadcast', message);
        }

        todo(this.host);
        this.clients.forEach(todo);

        // todo: proper callback
        cb(true, 'ok');
    };

//
// Rooms Manager
//
function Rooms() {
    this.rooms = {};

    return this;
}

Rooms.prototype.create =
    function RoomsCreateRoom(socket) {
        var self = this;
        var uniqid = false;

        do {
            uniqid = func.uniqid('mp-', true);
        } while(self.rooms[uniqid]);

        self.rooms[uniqid] = new Room(socket);
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

Rooms.prototype.joinRoom =
    function RoomsJoinRoom(room, socket) {
        var self = this;

        if (self.hasRoom(room)) {
            return self.rooms[room].addClient(room);
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
