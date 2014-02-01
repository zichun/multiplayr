var rooms = new Rooms();

function Init(io) {
    io.sockets.on('connection', function (socket) {
        var roomId, clientId;

        socket.on('create-room', function () {
            if (roomId !== false || clientId !== false) {
                return socket.emit('error', {
                    message: 'Client already belong to an existing mesh'
                });
            }

            var room = rooms.create(socket);
            roomId = room.roomId;
            clientId = room.clientId;
        });

        socket.on('join-room', function(data) {
            if (typeof data.room !== 'string') {
                return socket.emit('error', {
                    message: 'Invalid request'
                });
            } else if (roomId !== false || clientId !== false) {
                return socket.emit('error', {
                    message: 'Client already belong to an existing mesh'
                });
            }

            if (rooms.hasRoom(data.room)) {
                roomId = data.room;
                clientId = rooms.addClient(data.room, socket);
            } else {
                return socket.emit('error', {
                    message: 'Room ' + data.room + ' does not exists'
                });
            }
        });

        socket.on('disconnect', function() {
            rooms.removeClient(clientId);
        });
    });
}


module.export = Init;
