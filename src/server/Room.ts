/**
 *
 * Room.ts
 *
 * Implemenetation of Room class.
 *
 */

import Session from './Session';

import {CallbackType,
        RoomMessageType,
        SessionMessageType,
        PacketType} from '../common/types';

import {returnError,
        returnSuccess,
        createRoomPacket} from '../common/messages';

export class Room {
    private id: string;
    private hostId: string;
    private clients: string[];
    private clientSessions: {[key: string]: any};
    private clientActiveMap: {[key: string]: boolean};

    constructor(roomId: string) {

        this.id = roomId;
        this.clients = [];
        this.clientSessions = {};
        this.clientActiveMap = {};
    }

    public getHostId(): string {
        return this.hostId;
    }

    public sendMessage(toClientId: string,
                        messageType: SessionMessageType,
                        data: PacketType,
                        cb?: CallbackType) {

        if (!data.session) {
            data.session = {
                action: messageType
            };
        }

        if (!this.hasClient(toClientId)) {
            return returnError(cb, 'Invalid toClientId - clientId ' + toClientId + ' does not belong in the room');
        } else {
            if (this.clientSessions[toClientId]) {
                return this.clientSessions[toClientId].sendMessage(data, cb);
            }
        }
    }

    // (async)
    // Send Messages from a client
    public clientSendMessage(fromClientId: string,
                             toClientId: string,
                             message: PacketType,
                             cb?: CallbackType) {

        if (!this.hasClient(fromClientId) || !this.hasClient(toClientId)) {
            return returnError(cb, 'Invalid fromClientId / toClientId');
        } else {
            this.sendMessage(toClientId,
                             SessionMessageType.SendMessage,
                             message,
                             cb);
        }
    }

    public hasClient(clientId: string) {

        return this.clients.indexOf(clientId) >= 0;
    }

    // Add Client to Room
    // @arg clientId Unique Id of client
    // @arg socket The socket.io object of the new client
    public addClient(clientId: string,
                     session: Session) {

        if (this.hasClient(clientId)) {
            return false;
        }

        if (this.clients.length === 0) {
            this.hostId = clientId;
        }

        this.clients.push(clientId);
        this.clientSessions[clientId] = session;
        this.clientActiveMap[clientId] = true;

        this.broadcastRoomActivity(RoomMessageType.JoinRoom,
                                   clientId);

        return true;
    }

    // Reconnect a client back to the room
    // @arg clientId Unique Id of client
    // @arg session The session object of the new client
    public reconnectClient(
        clientId: string,
        session: Session,
        fn?: CallbackType
    ): Room {
        if (this.hasClient(clientId) === false) {
            returnError(fn, 'Room does not have existing client ' + clientId);
            return null;
        }

        this.clientActiveMap[clientId] = true;
        this.clientSessions[clientId] = session;

        const broadcastType = RoomMessageType.RejoinRoom;

        this.broadcastRoomActivity(broadcastType,
                                   clientId);

        returnSuccess(fn, 'reconnect', this.hostId);

        return this;
    }

    // Mark a client as disconnected. When enumerating clients (broadcast / getClient),
    // this client will be omitted, until the clientId has been reconnected.
    // @arg clientId Unique Id of client
    // @return false if client does not exists, and true otherwise.
    public disconnectClient(clientId: string) {

        const index = this.clients.indexOf(clientId);

        if (index === -1) {
            return false;
        }

        this.clientActiveMap[clientId] = false;
        this.clientSessions[clientId] = null;

        this.broadcastRoomActivity(RoomMessageType.LeaveRoom,
                                   clientId);

        return true;
    }

    // (async)
    // Broadcast message to room
    // @arg msgType Type of message
    // @arg message Message to send
    // @arg cb Callback function
    public broadcastRoomActivity(
        roomAction: RoomMessageType,
        clientId: string,
        cb?: CallbackType
    ) {
        Object.keys(this.clientActiveMap).forEach(
            (toClientId) => {
                if (this.clientActiveMap[clientId] === true) {

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

        Object.keys(this.clientActiveMap).forEach(
            (clientId) => {
                if (this.clientActiveMap.hasOwnProperty(clientId) &&
                    this.clientActiveMap[clientId] === true) {

                    tr.push(clientId);
                }
            });

        return tr;
    }

    // Get all clients, including disconnected ones.
    public getAllClients() {
        const tr = [];

        Object.keys(this.clientActiveMap).forEach(
            (clientId) => {
                if (this.clientActiveMap.hasOwnProperty(clientId)) {
                    tr.push(clientId);
                }
            });

        return tr;
    }

    public getRoomId() {
        return this.id;
    }

}

export default Room;
