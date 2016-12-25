/**
 *
 * socket.transport.ts
 *
 * Uses socket.io to implement the transport layer.
 *
 */

import Rooms from './rooms';
import MPRULES from '../../rules/rules';
import {SocketIoCallbackType, JoinRoomType, RoomMessageType} from '../common/types';

const rooms = new Rooms();

export function init(io: any) {

    io.sockets.on('connection', (socket) => {

        let roomId: string = null
        let clientId: string = null;

        socket.on('create-room', (data, fn) => {
            if (roomId !== null || clientId !== null) {
                return fn({
                    type: 'error',
                    message: 'Client already belong to an existing mesh'
                });
            }

            if (data.rule === undefined || MPRULES[data.rule] === undefined) {
                return fn({
                    type: 'error',
                    message: 'No such rule ' + data.rule
                });
            }

            // todo: rules should ideally be abstracted from room
            const room = rooms.create(socket, data.rule);
            roomId = room.roomId;
            clientId = room.clientId;

            fn({
                roomId: roomId,
                clientId: clientId
            });
        });

        socket.on('has-room', (data, fn) => {
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

        function joinRoom(
            data: JoinRoomType,
            fn: SocketIoCallbackType
        ) {
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

        function rejoinRoom(
            data: JoinRoomType,
            fn: SocketIoCallbackType
        ) {
            if (rooms.hasRoom(data.roomId)) {

                roomId = data.roomId;
                clientId = data.clientId;

                const result = rooms.reconnectClient(roomId, socket, clientId, true);

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

        socket.on('rejoin-room',
                  (data: JoinRoomType,
                   fn: SocketIoCallbackType) => {

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

        socket.on('join-room',
                  (data: JoinRoomType,
                   fn: SocketIoCallbackType) => {

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

        socket.on('send-message',
                  (data: RoomMessageType,
                   fn: SocketIoCallbackType) => {

                       if (data.message === undefined || typeof data.toClientId !== 'string') {
                           return fn({
                               type: 'error',
                               message: 'Invalid request'
                           });
                       }

                       rooms.sendMessage(roomId,
                                         clientId,
                                         data.toClientId,
                                         data.message,
                                         (err, doc) => {
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

        socket.on('disconnect', () => {
            if (clientId !== null) {
                rooms.disconnectClient(clientId);
            }
        });

        // Get connected clients to room
        socket.on('room-clients',
                  (data: JoinRoomType,
                   fn: SocketIoCallbackType) => {

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
