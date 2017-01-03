/**
 *
 * session.ts (client).
 *
 * The session layer implements the room management protocol.
 *
 */

import SocketTransport from './socket.transport';
import DataExchange from './dxc';

import {returnError,
        createSessionPacket,
        checkReturnMessage,
        forwardReturnMessage} from '../../common/messages';

import {SessionMessageType,
        CallbackType,
        PacketType,
        RoomMessageType} from '../../common/types';

export class Session {
    private clientId: string;
    private hostId: string;
    private roomId: string;
    private dxc: DataExchange;
    private transport: SocketTransport;

    constructor(
        transport: SocketTransport
    ) {
        this.transport = transport;
        this.clientId = transport.getClientId();

        this.transport.setSession(this);

        if (!this.clientId) {
            throw 'Session constructed with an invalid transport object';
        }
    }

    /**
     * Emits a SessionMessageType.CreateRoom action
     * Expects the server-side session layer to return the roomId in the return message.
     * The current client will be the host of the room.
     */
    public createRoom(
        cb?: CallbackType
    ) {
        const packet = createSessionPacket(SessionMessageType.CreateRoom);
        packet.session.fromClientId = this.clientId;

        this.transport.sendMessage(packet, (data) => {
            if (!data.success) {
                return checkReturnMessage(data, 'roomId', cb);
            }

            this.roomId = data.message;
            this.hostId = this.clientId;

            return forwardReturnMessage(data, cb);
        });
    }

    /**
     * Emits a SessionMessageType.JoinRoom action
     * Expects the server-side session layer to return the hostId in the return message.
     */
    public joinRoom(
        roomId: string,
        cb?: CallbackType
    ) {
        const packet = createSessionPacket(SessionMessageType.JoinRoom);
        packet.session.roomId = roomId;
        packet.session.fromClientId = this.clientId;

        this.transport.sendMessage(packet, (res) => {
            if (!res.success) {
                return checkReturnMessage(res, 'hostId', cb);
            }

            this.hostId = res.message;
            this.roomId = roomId;

            return forwardReturnMessage(res, cb);
        });
    }

    public rejoinRoom(
        roomId: string,
        clientId: string,
        cb?: CallbackType
    ) {
        const packet = createSessionPacket(SessionMessageType.RejoinRoom);
        packet.session.roomId = roomId;
        packet.session.fromClientId = clientId;

        this.transport.sendMessage(packet, (res) => {
            if (!res.success) {
                return checkReturnMessage(res, 'hostId', cb);
            }

            this.hostId = res.message;
            this.roomId = roomId;
            this.clientId = clientId;
            this.transport.updateClientId();

            return forwardReturnMessage(res, cb);
        });
    }

    public sendMessage(
        clientId: string,
        data: PacketType,
        cb?: CallbackType
    ) {
        data.session = {
            action: SessionMessageType.SendMessage,
            toClientId: clientId,
            fromClientId: this.clientId
        };

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

        case SessionMessageType.RoomBroadcast:
            // a broadcast is being emitted from the room.
            return this.serviceBroadcastMessage(data, fn);

        case SessionMessageType.SendMessage:
            // Received a (routed) SendMessage from another client. Forward it to the dxc layer.
            if (this.dxc !== undefined) {
                this.dxc.onMessage(data, fn);
            }
            break;

        default:
            return returnError(fn, 'invalid data packet (invalid session action - ' + data.session.action + ')');
        }
    }

    private serviceBroadcastMessage(
        data: PacketType,
        fn?: CallbackType
    ) {
        if (!data.room || !data.room.action || !data.room.clientId) {
            return returnError(fn, 'invalid data packet (missing room key)');
        }

        if (!this.isHost()) {
            // only host needs to know about room membership.
            return;
        }

        switch (data.room.action) {

        case RoomMessageType.JoinRoom:
            return this.dxc.onJoinRoom(data.room.clientId);

        case RoomMessageType.RejoinRoom:
            return this.dxc.onRejoinRoom(data.room.clientId);

        case RoomMessageType.LeaveRoom:
            return this.dxc.onLeaveRoom(data.room.clientId);

        default:
            return returnError(fn, 'invalid data packet (invalid room action - ' + data.session.action + ')');
        }
    }

    public setDxc(dxc: DataExchange) {
        if (this.dxc === undefined) {
            this.dxc = dxc;
        } else {
            throw('DataExchange has already been set for this session object');
        }
    }

    public getClientId() {
        return this.clientId;
    }

    public getRoomId() {
        return this.roomId;
    }

    public getHostId() {
        return this.hostId;
    }

    public isHost() {
        return this.hostId === this.clientId;
    }
}

export default Session;
