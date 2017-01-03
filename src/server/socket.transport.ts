/**
 *
 * socket.transport.ts (server).
 *
 * Uses socket.io to implement the transport layer.
 *
 */

import Rooms from './rooms';
import Session from './session';

import {isFunction} from '../common/utils';

import {CallbackType,
        JoinRoomType,
        RoomMessageType,
        PacketType,
        ReconnectPacketType} from '../common/types';

import {returnError,
        returnSuccess,
        forwardReturnMessage} from '../common/messages';

export class SocketTransport {
    private socket: any;
    private session: Session = null;
    private initialized: boolean;

    constructor(socket: any) {
        this.initialized = false;
        this.socket = socket;
        this.initialize();
    }

    private initialize() {

        this.socket.on('initialize',
                       (data: any, fn: CallbackType) => {

                           if (this.initialized) {
                               return returnError(fn,
                                                  'transport has already been initialized (clientId: ' + this.session.getClientId() + ')');
                           }

                           this.session = new Session(this);
                           this.initialized = true;

                           console.log('New client connected: ' + this.session.getClientId());

                           return returnSuccess(fn, 'clientId', this.session.getClientId());
                       });

        this.socket.on('rejoin',
                       (data: ReconnectPacketType, fn: CallbackType) => {
                           // todo: handle reconnection logic
                           if (this.session || this.initialized) {
                               return returnError(fn,
                                                  'transport has already been initialized, cannot rejoin (clientId: ' +
                                                  this.session.getClientId() + ')');
                           }

                           if (!data.roomId || !data.clientId) {
                               return returnError(fn,
                                                  'invalid reconnection packet (missing data.roomId/clientId)');
                           }

                           this.initialized = true;
                           this.session = new Session(this);
                           this.session.reconnect(data.roomId,
                                                  data.clientId,
                                                  (res) => {
                                                      if (res.success === false) {
                                                          this.session = null;
                                                          this.initialized = false;
                                                      }
                                                      return forwardReturnMessage(res, fn);
                                                  });
                       });

        this.socket.on('message',
                       (data: PacketType, fn: CallbackType) => {

                           if (!this.initialized) {
                               return returnError(fn, 'transport session has not been initialized');
                           }

                           if (data.transport === undefined) {
                               return returnError(fn, 'invalid data packet (missing transport key)');
                           }

                           this.session.onMessage(data, fn);
                       });

        this.socket.on('disconnect', () => {
            if (this.initialized) {
                console.log('Client disconnected: ' + this.session.getClientId());
                this.session.onDisconnect();

                this.initialized = false;
                this.session = null;
            }
        });
    }

    public sendMessage(
        data: PacketType,
        cb?: CallbackType
    ) {
        this.socket.emit('message',
                         data,
                         cb);
    }

    public static NEW_CONNECTION(socket: any) {
        const transport = new SocketTransport(socket)
    }
}

function init(io: any) {

    // io.sockets.on('connection', (socket) => {

    //     let roomId: string = null
    //     let clientId: string = null;

    //     socket.on('create-room', (data, fn) => {
    //         if (roomId !== null || clientId !== null) {
    //             return fn({
    //                 type: 'error',
    //                 message: 'Client already belong to an existing mesh'
    //             });
    //         }

    //         if (data.rule === undefined) {
    //             return fn({
    //                 type: 'error',
    //                 message: 'No rule given'
    //             });
    //         }

    //         // todo: rules should ideally be abstracted from room
    //         const room = rooms.create(socket, data.rule);
    //         roomId = room.roomId;
    //         clientId = room.clientId;

    //         fn({
    //             roomId: roomId,
    //             clientId: clientId
    //         });
    //     });

    //     socket.on('has-room', (data, fn) => {
    //         if (typeof data.roomId !== 'string') {
    //             return fn({
    //                 type: 'error',
    //                 message: 'Invalid request'
    //             });
    //         }

    //         return fn({
    //             roomId: data.roomId,
    //             exists: rooms.hasRoom(data.roomId)
    //         });
    //     });

    //     function joinRoom(
    //         data: JoinRoomType,
    //         fn: SocketIoCallbackType
    //     ) {
    //         if (rooms.hasRoom(data.roomId)) {
    //             roomId = data.roomId;

    //             if (data.clientId) {
    //                 clientId = data.clientId;
    //                 rooms.reconnectClient(data.roomId, socket, clientId, false);
    //             } else {
    //                 clientId = rooms.addClient(data.roomId, socket);
    //             }
    //             return fn({
    //                 roomId: roomId,
    //                 clientId: clientId
    //             });
    //         } else {
    //             return fn({
    //                 type: 'error',
    //                 message: 'Room ' + data.roomId + ' does not exists'
    //             });
    //         }
    //     }

    //     function rejoinRoom(
    //         data: JoinRoomType,
    //         fn: SocketIoCallbackType
    //     ) {
    //         if (rooms.hasRoom(data.roomId)) {

    //             roomId = data.roomId;
    //             clientId = data.clientId;

    //             const result = rooms.reconnectClient(roomId, socket, clientId, true);

    //             return fn({
    //                 roomId: roomId,
    //                 clientId: clientId,
    //                 status: result
    //             });

    //         } else {
    //             return fn({
    //                 type: 'error',
    //                 message: 'Room ' + data.roomId + ' does not exists'
    //             });
    //         }
    //     }

    //     socket.on('rejoin-room',
    //               (data: JoinRoomType,
    //                fn: SocketIoCallbackType) => {

    //                    if (typeof data.roomId !== 'string' ||
    //                        typeof data.clientId !== 'string') {
    //                        return fn({
    //                            type: 'error',
    //                            message: 'Invalid request'
    //                        });
    //                    } else if (roomId !== null || clientId !== null) {
    //                        return fn({
    //                            type: 'error',
    //                            message: 'Client already belong to an existing mesh'
    //                        });
    //                    }

    //                    rejoinRoom(data, fn);
    //                });

    //     socket.on('join-room',
    //               (data: JoinRoomType,
    //                fn: SocketIoCallbackType) => {

    //                    if (typeof data.roomId !== 'string') {
    //                        return fn({
    //                            type: 'error',
    //                            message: 'Invalid request'
    //                        });
    //                    } else if (roomId !== null || clientId !== null) {
    //                        return fn({
    //                            type: 'error',
    //                            message: 'Client already belong to an existing mesh'
    //                        });
    //                    }

    //                    return joinRoom(data, fn);
    //                });

    //     socket.on('send-message',
    //               (data: RoomMessageType,
    //                fn: SocketIoCallbackType) => {

    //                    if (data.message === undefined || typeof data.toClientId !== 'string') {
    //                        return fn({
    //                            type: 'error',
    //                            message: 'Invalid request'
    //                        });
    //                    }

    //                    rooms.sendMessage(roomId,
    //                                      clientId,
    //                                      data.toClientId,
    //                                      data.message,
    //                                      (err, doc) => {
    //                                          if (err) {
    //                                              return fn({
    //                                                  type: 'error',
    //                                                  message: err
    //                                              });
    //                                          } else {
    //                                              return fn(doc);
    //                                          }
    //                                      });
    //                });

    //     socket.on('disconnect', () => {
    //         if (clientId !== null) {
    //             rooms.disconnectClient(clientId);
    //         }
    //     });

    //     // Get connected clients to room
    //     socket.on('room-clients',
    //               (data: JoinRoomType,
    //                fn: SocketIoCallbackType) => {

    //                    if (clientId === null) {
    //                        return fn({
    //                            type: 'error',
    //                            message: 'Not connected to room yet'
    //                        });
    //                    } else {
    //                        return fn(rooms.getClients(roomId));
    //                    }
    //                });
    // });
}

export default SocketTransport;
