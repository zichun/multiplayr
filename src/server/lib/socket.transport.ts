///<reference path='../../typescript-definitions/typescript-node-definitions/node.d.ts'/>
///<reference path='../../typescript-definitions/typescript-node-definitions/socket.io.d.ts'/>

import Rooms = require('./rooms.js');
var rules = require('../rules.js');

var rooms = new Rooms();

function init(io) {
    io.sockets.on('connection', function (socket) {
        let roomId: string = null
        let clientId: string = null;

        socket.on('create-room', function (data, fn) {
            if (roomId !== null || clientId !== null) {
                return fn({
                    type: 'error',
                    message: 'Client already belong to an existing mesh'
                });
            }

            if (typeof data.rule === 'undefined' || typeof rules[data.rule] === 'undefined') {
                return fn({
                    type: 'error',
                    message: 'No such rule ' + data.rule
                });
            }

            // todo: rules should ideally be abstracted from room
            var room = rooms.create(socket, data.rule);
            roomId = room.roomId;
            clientId = room.clientId;

            fn({
                roomId: roomId,
                clientId: clientId
            });
        });

        socket.on('has-room', function(data, fn) {
            if (typeof data.roomId !== 'string') {
                return fn({
                    type: 'error',
                    message: 'Invalid request'
                });
            }

            return fn({
                roomId: data.roomId,
                exists: rooms.hasRoom(data.roomId)
            });
        });

        function joinRoom(data, fn) {
            if (rooms.hasRoom(data.roomId)) {
                roomId = data.roomId;

                if (data.clientId) {
                    clientId = data.clientId;
                    rooms.reconnectClient(data.roomId, socket, clientId, false);
                } else {
                    clientId = rooms.addClient(data.roomId, socket);
                }
                return fn({
                    roomId: roomId,
                    clientId: clientId
                });
            } else {
                return fn({
                    type: 'error',
                    message: 'Room ' + data.roomId + ' does not exists'
                });
            }
        }

        function rejoinRoom(data, fn) {
            if (rooms.hasRoom(data.roomId)) {

                roomId = data.roomId;
                clientId = data.clientId;

                var result = rooms.reconnectClient(roomId, socket, clientId, true);

                return fn({
                    roomId: roomId,
                    clientId: clientId,
                    status: result
                });

            } else {
                return fn({
                    type: 'error',
                    message: 'Room ' + data.roomId + ' does not exists'
                });
            }
        }

        socket.on('rejoin-room', function(data, fn) {
            if (typeof data.roomId !== 'string' ||
                typeof data.clientId !== 'string') {
                return fn({
                    type: 'error',
                    message: 'Invalid request'
                });
            } else if (roomId !== null || clientId !== null) {
                return fn({
                    type: 'error',
                    message: 'Client already belong to an existing mesh'
                });
            }

            rejoinRoom(data, fn);
        });

        socket.on('join-room', function(data, fn) {
            if (typeof data.roomId !== 'string') {
                return fn({
                    type: 'error',
                    message: 'Invalid request'
                });
            } else if (roomId !== null || clientId !== null) {
                return fn({
                    type: 'error',
                    message: 'Client already belong to an existing mesh'
                });
            }

            return joinRoom(data, fn);
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
                    return fn(doc);
                }
            });
        });

        socket.on('disconnect', function() {
            if (clientId !== null) {
                rooms.disconnectClient(clientId);
            }
        });

        // Get connected clients to room
        socket.on('room-clients', function(data, fn) {
            if (clientId === null) {
                return fn({
                    type: 'error',
                    message: 'Not connected to room yet'
                });
            } else {
                return fn(rooms.getClients(roomId));
            }
        });
    });
}


module.exports = {
    init: init
};
