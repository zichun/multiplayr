/**
 *
 * session.ts (server).
 *
 * The session layer implements the room management protocol.
 *
 */

import Rooms from './rooms';
import Room from './room';

import SocketTransport from './socket.transport'; // todo: make this an interface

import {uniqueId,
        isFunction} from '../common/utils';

import {CallbackType,
        SessionMessageType,
        PacketType} from '../common/types';

import {returnError,
        returnSuccess,
        checkReturnMessage} from '../common/messages';

const rooms = new Rooms();

export class Session {
    private transport: SocketTransport;
    private clientId: string;
    private room: Room;

    constructor(
        transport: SocketTransport
    ) {
        this.transport = transport;
        this.clientId = uniqueId('mp-client-', true);
    }

    public reconnect(
        roomId: string,
        clientId: string,
        fn?: CallbackType
    ) {
        this.clientId = clientId;
        this.room = rooms.reconnectClient(roomId, this, clientId, fn);
    }

    private createRoom(
        fn?: CallbackType
    ) {
        if (this.room !== undefined) {
            return returnError(fn, 'Session of clientId ' + this.clientId + ' already belongs to a room');
        }

        this.room = rooms.create(this.clientId, this);
        return returnSuccess(fn, 'roomId', this.room.getRoomId());
    }

    private rejoinRoom(
        data: PacketType,
        fn?: CallbackType
    ) {
        if (!data.session || !data.session.roomId || !data.session.fromClientId) {
            return returnError(fn, 'Invalid packet - missing session.roomid/fromClientId');
        }

        if (this.room !== undefined) {
            return returnError(fn, 'Session of clientId ' + this.clientId + ' already belongs to a room');
        }

        const roomId = data.session.roomId;
        const clientId = data.session.fromClientId;

        this.reconnect(roomId, clientId, (res) => {
            if (!res.success) {
                return checkReturnMessage(res, 'reconnect', fn);
            }

            console.log('Client[' + clientId + '] successfully reconnected to Room[' + roomId + ']');

            return returnSuccess(fn, 'hostId', res.message);
        });
    }

    private joinRoom(
        data: PacketType,
        fn?: CallbackType
    ) {
        if (!data.session || !data.session.roomId) {
            return returnError(fn, 'Invalid packet - missing session.roomid');
        }

        if (this.room !== undefined) {
            return returnError(fn, 'Session of clientId ' + this.clientId + ' already belongs to a room');
        }

        const roomId = data.session.roomId;
        const room = rooms.addClient(roomId, this, fn);

        if (room) {
            this.room = room;
            return returnSuccess(fn, 'hostId', this.room.getHostId());
        } else {
            return returnError(fn, 'Failed to join room');
        }
    }

    private routeMessage(
        data: PacketType,
        cb?: CallbackType
    ) {
        const toClientId = data.session.toClientId;
        const fromClientId = data.session.fromClientId;

        if (fromClientId !== this.clientId) {
            return returnError(cb, 'Invalid fromClientId');
        }

        return this.room.sendMessage(toClientId,
                                     SessionMessageType.SendMessage,
                                     data,
                                     cb);
    }

    public sendMessage(
        data: PacketType,
        cb?: CallbackType
    ) {
        this.transport.sendMessage(data, cb);
    }

    public onMessage(
        data: PacketType,
        fn?: CallbackType
    ) {
        if (!data.session || !data.session.action) {
            return returnError(fn, 'invalid data packet (missing session key)');
        }

        switch (data.session.action) {

        case SessionMessageType.CreateRoom:
            return this.createRoom(fn);

        case SessionMessageType.JoinRoom:
            return this.joinRoom(data, fn);

        case SessionMessageType.SendMessage:
            // Received a SendMessage from one client to another client. Route the message via the room object.
            return this.routeMessage(data, fn);

        case SessionMessageType.RejoinRoom:
            return this.rejoinRoom(data, fn);

        default:
            return returnError(fn, 'invalid data packet (invalid data session action - ' + data.session.action + ')');
        }
    }

    public onDisconnect(
        fn?: CallbackType
    ) {
        rooms.disconnectClient(this.clientId, fn);
    }

    public getClientId() {
        return this.clientId;
    }
}

export default Session;
