var room = new Room();

function Init(io) {
    io.sockets.on('connection', function (socket) {

        //
        // Create Room
        //
        socket.on('create-room', function (data) {
            Room.create(socket);
        });
    });
}


module.export = Init;
