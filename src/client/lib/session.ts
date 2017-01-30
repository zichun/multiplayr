/**
 *
 * session.ts (client).
 *
 * The session layer implements the room management protocol.
 *
 */

import {
    returnError,
    createSessionPacket,
    checkReturnMessage,
    forwardReturnMessage
} from '../../common/messages';

import {
    SessionMessageType,
    CallbackType,
    PacketType,
    RoomMessageType
} from '../../common/types';

import {
    ClientTransportInterface,
    ClientDataExchangeInterface,
    ClientSessionInterface
} from '../../common/interfaces';

export class Session implements ClientSessionInterface {
    private _onMessage: (packet: PacketType, cb?: CallbackType) => void;
    private _onJoinRoom: (clientId: string) => void;
    private _onRejoinRoom: (clientId: string) => void;
    private _onLeaveRoom: (clientId: string) => void;
    private _onReconnect: () => void;

    private _clientId: string;
    private _hostId: string;
    private _roomId: string;
    private _transport: ClientTransportInterface;

    constructor(
        transport: ClientTransportInterface
    ) {
        this._transport = transport;
        this._clientId = transport.getClientId();

        this._transport.setSession(this);

        if (!this._clientId) {
            throw 'Session constructed with an invalid transport object';
        }

        this._onMessage = (packet, cb) => {};
        this._onJoinRoom = (clientId) => {};
        this._onRejoinRoom = (clientId) => {};
        this._onLeaveRoom = (clientId) => {};
        this._onReconnect = () => {};
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
        packet.session.fromClientId = this._clientId;

        this._transport.sendMessage(packet, (data) => {
            if (!data.success) {
                return checkReturnMessage(data, 'roomId', cb);
            }

            this._roomId = data.message;
            this._hostId = this._clientId;

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
        packet.session.fromClientId = this._clientId;

        this._transport.sendMessage(packet, (res) => {
            if (!res.success) {
                return checkReturnMessage(res, 'hostId', cb);
            }

            this._hostId = res.message;
            this._roomId = roomId;

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

        this._transport.sendMessage(packet, (res) => {
            if (!res.success) {
                return checkReturnMessage(res, 'hostId', cb);
            }

            this._hostId = res.message;
            this._roomId = roomId;
            this._clientId = clientId;
            this._transport.updateClientId();

            return forwardReturnMessage(res, cb);
        });
    }

    public sendMessage(
        clientId: string,
        packet: PacketType,
        cb?: CallbackType
    ) {
        packet.session = {
            action: SessionMessageType.SendMessage,
            toClientId: clientId,
            fromClientId: this._clientId
        };

        this._transport.sendMessage(packet, cb);
    }

    public onMessage(
        packet: PacketType,
        cb?: CallbackType
    ) {
        if (!packet.session || !packet.session.action) {
            return returnError(cb, 'invalid data packet (missing session key)');
        }

        switch (packet.session.action) {

        case SessionMessageType.RoomBroadcast:
            // a broadcast is being emitted from the room.
            return this.serviceBroadcastMessage(packet, cb);

        case SessionMessageType.SendMessage:
            // Received a (routed) SendMessage from another client. Forward it to the layer above.
            this._onMessage(packet, cb);
            break;

        default:
            return returnError(cb, 'invalid data packet (invalid session action - ' + packet.session.action + ')');
        }
    }

    private serviceBroadcastMessage(
        packet: PacketType,
        cb?: CallbackType
    ) {
        if (!packet.room || !packet.room.action || !packet.room.clientId) {
            return returnError(cb, 'invalid data packet (missing room key)');
        }

        if (!this.isHost()) {
            // only host needs to know about room membership.
            return;
        }

        switch (packet.room.action) {

        case RoomMessageType.JoinRoom:
            return this._onJoinRoom(packet.room.clientId);

        case RoomMessageType.RejoinRoom:
            return this._onRejoinRoom(packet.room.clientId);

        case RoomMessageType.LeaveRoom:
            return this._onLeaveRoom(packet.room.clientId);

        default:
            return returnError(cb, 'invalid data packet (invalid room action - ' + packet.session.action + ')');
        }
    }

    public onReconnect() {
        this._onReconnect();
    }

    public setCallbacks(
        callBacks: {
            onMessage?: (packet: PacketType, cb?: CallbackType) => void,
            onJoinRoom?: (clientId: string) => void,
            onRejoinRoom?: (clientId: string) => void,
            onLeaveRoom?: (clientId: string) => void,
            onReconnect?: () => void
        }
    ) {
        if (callBacks.onMessage) {
            this._onMessage = callBacks.onMessage;
        }
        if (callBacks.onJoinRoom) {
            this._onJoinRoom = callBacks.onJoinRoom;
        }
        if (callBacks.onRejoinRoom) {
            this._onRejoinRoom = callBacks.onRejoinRoom;
        }
        if (callBacks.onLeaveRoom) {
            this._onLeaveRoom = callBacks.onLeaveRoom;
        }
        if (callBacks.onReconnect) {
            this._onReconnect = callBacks.onReconnect;
        }
    }


    public getClientId() {
        return this._clientId;
    }

    public getRoomId() {
        return this._roomId;
    }

    public getHostId() {
        return this._hostId;
    }

    public isHost() {
        return this._hostId === this._clientId;
    }
}

export default Session;
