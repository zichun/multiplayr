import {randomRoomId, uniqueId} from '../common/utils.js';
import * as constants from '../common/constants.js';
import Room from './Room.js';

class Rooms {
    rooms: {[key: string]: Room};
    clientsRoomMap: {[key: string]: string};
    roomCleanupTimer: {[key: string]: any};

    constructor() {
        this.rooms = {};
        this.clientsRoomMap = {};
        this.roomCleanupTimer = {};
    }

    create(socket, rule): {
        roomId: string,
        clientId: string
    }
    {
        var self = this;
        var uniqid = '', clientId = '';

        do {
            uniqid = randomRoomId();
        } while(self.rooms[uniqid]);

        clientId = uniqueId('mp-client-', true);

        self.rooms[uniqid] = new Room(uniqid, rule);
        self.rooms[uniqid].addClient(clientId, socket);

        self.clientsRoomMap[clientId] = uniqid;

        return {
            "roomId": uniqid,
            "clientId": clientId
        };
    }

    hasRoom(room) {
        var self = this;
        for (var rooms in self.rooms) {
            if (self.rooms.hasOwnProperty(rooms) && rooms === room) {
                return true;
            }
        }
        return false;
    }

    getClientRoom(clientId) {
        var self = this;

        if (!self.clientsRoomMap[clientId]) {
            throw(new Error("Client Id does not exist"));
        }
        return self.clientsRoomMap[clientId];
    }

    deleteRoom(roomId) {
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
    }

    unmarkRoomForCleanup(roomId) {
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
    }

    // Start a timer to mark the room for cleanup.
    // Whenever a new client joins, reset this timer.
    markRoomForCleanup(roomId) {
        var self = this;

        if (self.hasRoom(roomId) === false) {
            throw(new Error("Room " + roomId + " does not exists."));
        }

        if (!self.roomCleanupTimer[roomId]) {
            console.log("Marking " + roomId + " for deletion");
            self.roomCleanupTimer[roomId] = setTimeout(function() {
                self.deleteRoom(roomId);
            }, constants.ROOMINACTIVELIFESPAN);
        }
        return self.roomCleanupTimer[roomId];
    }

    // Disconnect a given client from the room management
    // @arg clientId Identifier of client
    disconnectClient(clientId) {
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
    }

    // Remove a given client from the room management. When client count hits 0, garbage collect room.
    // @arg clientId Identifier of client
    removeClient(clientId) {
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
    }

    getRooms() {
        var self = this;
        var tr = [];

        for (var rooms in self.rooms) {
            if (self.rooms.hasOwnProperty(rooms)) {
                tr.push(rooms);
            }
        }

        return rooms;
    }

    getClients(room) {
        var self = this;

        if (self.hasRoom(room)) {
            return self.rooms[room].getClients();
        } else {
            throw(new Error('Room does not exists'));
        }
    }

    reconnectClient(room, socket, clientId, socketioReconnect) {
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
    }

    addClient(room, socket) {
        var self = this;
        var clientId = '';

        if (self.hasRoom(room)) {
            clientId = uniqueId('mp-client-', true);
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

    sendMessage(room, from, to, message, cb?) {
        var self = this;

        if (self.hasRoom(room)) {
            self.rooms[room].clientSendMessage(from, to, message, cb);
        } else {
            cb && cb('Room does not exists', false);
        }
    };
}

export = Rooms;
