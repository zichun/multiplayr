var Rooms = require('./room.js');

var rooms = new Rooms();

function init(io) {
    io.sockets.on('connection', function (socket) {
        var roomId = false, clientId = false;

        socket.on('create-room', function (data, fn) {
            if (roomId !== false || clientId !== false) {
                return fn({
                    type: 'error',
                    message: 'Client already belong to an existing mesh'
                });
            }

            var room = rooms.create(socket);
            roomId = room.roomId;
            clientId = room.clientId;
            fn({
                roomId: roomId,
                clientId: clientId
            });
        });

        socket.on('join-room', function(data, fn) {
            if (typeof data.room !== 'string') {
                return fn({
                    type: 'error',
                    message: 'Invalid request'
                });
            } else if (roomId !== false || clientId !== false) {
                return fn({
                    type: 'error',
                    message: 'Client already belong to an existing mesh'
                });
            }

            if (rooms.hasRoom(data.room)) {
                roomId = data.room;
                clientId = rooms.addClient(data.room, socket);
                fn({
                    roomId: roomId,
                    clientId: clientId
                });
            } else {
                return fn({
                    type: 'error',
                    message: 'Room ' + data.room + 'does not exists'
                });
            }
        });

        socket.on('send-message', function(data, fn) {
            if (typeof data.message === 'undefined' || typeof data.to !== 'string') {
                return fn({
                    type: 'error',
                    message: 'Invalid request'
                });
            }

            rooms.sendMessage(roomId, clientId, data.to, data.message, function(err, doc) {
                if (err) {
                    return fn({
                        type: 'error',
                        message: err
                    });
                } else {
                    fn(doc);
                }
            });
        });

        socket.on('disconnect', function() {
            if (clientId !== false) {
                rooms.removeClient(clientId);
            }
        });

        // Get connected clients to room
        socket.on('room-clients', function(data, fn) {
            if (clientId === false) {
                return fn({
                        type: 'error',
                        message: 'Not connected to room yet'
                });
            } else {
                return fn(rooms.getClients(romId));
            }
        });
    });
}


module.exports = {
    init: init
};
