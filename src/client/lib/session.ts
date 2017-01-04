/**
 *
 * session.ts (client).
 *
 * The session layer implements the room management protocol.
 *
 */

import {returnError,
        createSessionPacket,
        checkReturnMessage,
        forwardReturnMessage} from '../../common/messages';

import {SessionMessageType,
        CallbackType,
        PacketType,
        RoomMessageType} from '../../common/types';

import {ClientTransportInterface,
        ClientDataExchangeInterface,
        ClientSessionInterface} from '../../common/interfaces';

export class Session implements ClientSessionInterface {
    private clientId: string;
    private hostId: string;
    private roomId: string;
    private dxc: ClientDataExchangeInterface;
    private transport: ClientTransportInterface;

    constructor(
        transport: ClientTransportInterface
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
        packet: PacketType,
        cb?: CallbackType
    ) {
        packet.session = {
            action: SessionMessageType.SendMessage,
            toClientId: clientId,
            fromClientId: this.clientId
        };

        this.transport.sendMessage(packet, cb);
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
            // Received a (routed) SendMessage from another client. Forward it to the dxc layer.
            if (this.dxc !== undefined) {
                this.dxc.onMessage(packet, cb);
            }
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
            return this.dxc.onJoinRoom(packet.room.clientId);

        case RoomMessageType.RejoinRoom:
            return this.dxc.onRejoinRoom(packet.room.clientId);

        case RoomMessageType.LeaveRoom:
            return this.dxc.onLeaveRoom(packet.room.clientId);

        default:
            return returnError(cb, 'invalid data packet (invalid room action - ' + packet.session.action + ')');
        }
    }

    public setDxc(dxc: ClientDataExchangeInterface) {
        if (this.dxc === undefined) {
            this.dxc = dxc;
        } else {
            throw('ClientDataExchangeInterface has already been set for this session object');
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
