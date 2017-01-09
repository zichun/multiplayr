/**
 *
 * session.ts (server).
 *
 * The session layer implements the room management protocol.
 *
 */

import Rooms from './rooms';
import Room from './room';

import {
    uniqueId,
    isFunction
} from '../common/utils';

import {
    CallbackType,
    SessionMessageType,
    PacketType
} from '../common/types';

import {
    returnError,
    returnSuccess,
    checkReturnMessage
} from '../common/messages';

import {
    ServerTransportInterface,
    ServerSessionInterface
} from '../common/interfaces';

const rooms = new Rooms();

export class Session implements ServerSessionInterface {
    private transport: ServerTransportInterface;
    private clientId: string;
    private room: Room;

    constructor(
        transport: ServerTransportInterface
    ) {
        this.transport = transport;
        this.clientId = uniqueId('mp-client-', true);
    }

    public reconnect(
        roomId: string,
        clientId: string,
        cb?: CallbackType
    ) {
        this.clientId = clientId;
        this.room = rooms.reconnectClient(roomId, this, clientId, cb);
    }

    public sendMessage(
        packetet: PacketType,
        cb?: CallbackType
    ) {
        this.transport.sendMessage(packetet, cb);
    }

    public onMessage(
        packet: PacketType,
        cb?: CallbackType
    ) {
        if (!packet.session || !packet.session.action) {
            return returnError(cb, 'invalid data packet (missing session key)');
        }

        switch (packet.session.action) {

            case SessionMessageType.CreateRoom:
                return this.createRoom(cb);

            case SessionMessageType.JoinRoom:
                return this.joinRoom(packet, cb);

            case SessionMessageType.SendMessage:
                // Received a SendMessage from one client to another client. Route the message via the room object.
                return this.routeMessage(packet, cb);

            case SessionMessageType.RejoinRoom:
                return this.rejoinRoom(packet, cb);

            default:
                return returnError(cb, 'invalid data packet (invalid data session action - ' + packet.session.action + ')');
        }
    }

    public onDisconnect(
        cb?: CallbackType
    ) {
        rooms.disconnectClient(this.clientId, cb);
    }

    public getClientId() {
        return this.clientId;
    }

    private createRoom(
        cb?: CallbackType
    ) {
        if (this.room !== undefined) {
            return returnError(cb, 'Session of clientId ' + this.clientId + ' already belongs to a room');
        }

        this.room = rooms.create(this.clientId, this);
        return returnSuccess(cb, 'roomId', this.room.getRoomId());
    }

    private rejoinRoom(
        packet: PacketType,
        cb?: CallbackType
    ) {
        if (!packet.session || !packet.session.roomId || !packet.session.fromClientId) {
            return returnError(cb, 'Invalid packet - missing session.roomid/fromClientId');
        }

        if (this.room !== undefined) {
            return returnError(cb, 'Session of clientId ' + this.clientId + ' already belongs to a room');
        }

        const roomId = packet.session.roomId;
        const clientId = packet.session.fromClientId;

        this.reconnect(roomId, clientId, (res) => {
            if (!res.success) {
                return checkReturnMessage(res, 'reconnect', cb);
            }

            console.log('Client[' + clientId + '] successfully reconnected to Room[' + roomId + ']');

            return returnSuccess(cb, 'hostId', res.message);
        });
    }

    private joinRoom(
        packet: PacketType,
        cb?: CallbackType
    ) {
        if (!packet.session || !packet.session.roomId) {
            return returnError(cb, 'Invalid packet - missing session.roomid');
        }

        if (this.room !== undefined) {
            return returnError(cb, 'Session of clientId ' + this.clientId + ' already belongs to a room');
        }

        const roomId = packet.session.roomId;
        const room = rooms.addClient(roomId, this, cb);

        if (room) {
            this.room = room;
            return returnSuccess(cb, 'hostId', this.room.getHostId());
        } else {
            return returnError(cb, 'Failed to join room');
        }
    }

    private routeMessage(
        packet: PacketType,
        cb?: CallbackType
    ) {
        const toClientId = packet.session.toClientId;
        const fromClientId = packet.session.fromClientId;

        if (fromClientId !== this.clientId) {
            return returnError(cb, 'Invalid fromClientId');
        }

        return this.room.sendMessage(toClientId,
            SessionMessageType.SendMessage,
            packet,
            cb);
    }
}

export default Session;
