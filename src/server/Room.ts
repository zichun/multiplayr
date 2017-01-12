/**
 *
 * Room.ts
 *
 * Implemenetation of Room class.
 *
 */

import Session from './Session';

import {
    CallbackType,
    RoomMessageType,
    SessionMessageType,
    PacketType
} from '../common/types';

import {
    returnError,
    returnSuccess,
    createRoomPacket
} from '../common/messages';

export class Room {
    private _id: string;
    private _hostId: string;
    private _clients: string[];
    private _clientSessions: { [key: string]: any };
    private _clientActiveMap: { [key: string]: boolean };

    constructor(roomId: string) {
        this._id = roomId;
        this._clients = [];
        this._clientSessions = {};
        this._clientActiveMap = {};
    }

    public getHostId(): string {
        return this._hostId;
    }

    public sendMessage(
        toClientId: string,
        messageType: SessionMessageType,
        packet: PacketType,
        cb?: CallbackType) {

        if (!packet.session) {
            packet.session = {
                action: messageType
            };
        }

        if (!this.hasClient(toClientId)) {
            return returnError(cb, 'Invalid toClientId - clientId ' + toClientId + ' does not belong in the room');
        } else {
            if (this._clientSessions[toClientId]) {
                return this._clientSessions[toClientId].sendMessage(packet, cb);
            }
        }
    }

    // (async)
    // Send Messages from a client
    public clientSendMessage(
        fromClientId: string,
        toClientId: string,
        packet: PacketType,
        cb?: CallbackType) {

        if (!this.hasClient(fromClientId) || !this.hasClient(toClientId)) {
            return returnError(cb, 'Invalid fromClientId / toClientId');
        } else {
            this.sendMessage(toClientId,
                SessionMessageType.SendMessage,
                packet,
                cb);
        }
    }

    public hasClient(clientId: string) {
        return this._clients.indexOf(clientId) >= 0;
    }

    /**
     * Add Client to Room
     * @param clientId Unique Id of client
     * @param socket The socket.io object of the new client
     */
    public addClient(
        clientId: string,
        session: Session
    ) {

        if (this.hasClient(clientId)) {
            return false;
        }

        if (this._clients.length === 0) {
            this._hostId = clientId;
        }

        this._clients.push(clientId);
        this._clientSessions[clientId] = session;
        this._clientActiveMap[clientId] = true;

        this.broadcastRoomActivity(RoomMessageType.JoinRoom,
            clientId);

        return true;
    }

    /**
     * Reconnect a client back to the room
     * @param clientId Unique Id of client
     * @param session The session object of the new client
     */
    public reconnectClient(
        clientId: string,
        session: Session,
        cb?: CallbackType
    ): Room {
        if (this.hasClient(clientId) === false) {
            returnError(cb, 'Room does not have existing client ' + clientId);
            return null;
        }

        this._clientActiveMap[clientId] = true;
        this._clientSessions[clientId] = session;

        const broadcastType = RoomMessageType.RejoinRoom;

        this.broadcastRoomActivity(broadcastType,
            clientId);

        returnSuccess(cb, 'reconnect', this._hostId);

        return this;
    }

    /**
     * Mark a client as disconnected.When enumerating clients (broadcast / getClient),
     * this client will be omitted, until the clientId has been reconnected.
     * @param clientId Unique Id of client
     * @return false if client does not exists, and true otherwise.
     */
    public disconnectClient(clientId: string) {
        const index = this._clients.indexOf(clientId);

        if (index === -1) {
            return false;
        }

        this._clientActiveMap[clientId] = false;
        this._clientSessions[clientId] = null;

        this.broadcastRoomActivity(RoomMessageType.LeaveRoom,
            clientId);

        return true;
    }

    /**
     * (async)
     * Broadcast message to room
     * @param msgType Type of message
     * @param message Message to send
     * @param cb Callback function
     */
    public broadcastRoomActivity(
        roomAction: RoomMessageType,
        clientId: string,
        cb?: CallbackType
    ) {
        Object.keys(this._clientActiveMap).forEach(
            (toClientId) => {
                if (this._clientActiveMap[clientId] === true) {

                    this.sendMessage(toClientId,
                        SessionMessageType.RoomBroadcast,
                        createRoomPacket(roomAction,
                            clientId));
                }
            });

        return returnSuccess(cb, 'Room.broadcast', true);
    };

    public getClients(): string[] {
        const tr = [];

        Object.keys(this._clientActiveMap).forEach(
            (clientId) => {
                if (this._clientActiveMap.hasOwnProperty(clientId) &&
                    this._clientActiveMap[clientId] === true) {

                    tr.push(clientId);
                }
            });

        return tr;
    }

    /**
     * Get all clients, including disconnected ones.
     */
    public getAllClients() {
        const tr = [];

        Object.keys(this._clientActiveMap).forEach(
            (clientId) => {
                if (this._clientActiveMap.hasOwnProperty(clientId)) {
                    tr.push(clientId);
                }
            });

        return tr;
    }

    public getRoomId() {
        return this._id;
    }
}

export default Room;
