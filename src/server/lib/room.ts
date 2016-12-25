/**
 *
 * Room.ts
 *
 * Implemenetation of Room class.
 *
 */

import {CallbackType, RoomMessageType} from '../common/types.js';

export class Room {
    private id: string;
    private clients: string[];
    private clientSockets: {[key: string]: any};
    private clientActiveMap: {[key: string]: boolean};
    private rule: string;

    constructor(roomId: string,
                rule: string) {

        this.id = roomId;
        this.clients = [];
        this.clientSockets = {};
        this.clientActiveMap = {};
        this.rule = rule;
    }

    private sendMessage(toClientId: string,
                       msgType: string,
                       message: RoomMessageType,
                       cb?: CallbackType) {

        if (!this.hasClient(toClientId)) {
            return cb && cb('Invalid receipient', false);
        } else {
            this.clientSockets[toClientId].emit(msgType, message);
            return cb && cb(null, true);
            // todo: proper callback bound to emit
        }
    }

    // (async)
    // Send Messages from a client
    public clientSendMessage(fromClientId: string,
                             toClientId: string,
                             message: string,
                             cb?: CallbackType) {

        if (!this.hasClient(fromClientId) || !this.hasClient(toClientId)) {
            if (cb !== undefined) {
                cb('Invalid sender / receipient', false);
            }
        } else {
            this.sendMessage(toClientId,
                             'client-sendmessage',
                             {
                                 fromClientId: fromClientId,
                                 message: message
                             },
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
                     socket: any) {

        if (this.hasClient(clientId)) {
            return false;
        }

        this.clients.push(clientId);
        this.clientSockets[clientId] = socket;
        this.clientActiveMap[clientId] = true;

        this.broadcast('join-room',
                       clientId,
                       () => {
                           this.sendMessage(clientId,
                                            'room-rule',
                                            {
                                                fromClientId: null,
                                                message: this.rule
                                            });
                       });

        return true;
    }

    // Reconnect a client back to the room
    // @arg clientId Unique Id of client
    // @arg socket The socket.io object of the new client
    // @arg socketioReonnect If it's due to a socketio reconnection, no need to resend rule
    public reconnectClient(clientId: string,
                           socket: any,
                           socketioReconnect?: boolean) {

        if (this.hasClient(clientId) === false) {
            return false;
        }

        this.clientActiveMap[clientId] = true;
        this.clientSockets[clientId] = socket;

        const broadcastMsg = socketioReconnect ? 'rejoin-room' : 'join-room';

        this.broadcast(broadcastMsg,
                       clientId,
                       () => {
                           if (!socketioReconnect) {
                               this.sendMessage(clientId,
                                                'room-rule',
                                                {
                                                    fromClientId: null,
                                                    message: this.rule
                                                });
                           }
                       });

        return true;
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

        return true;
    }

    // Remove client from room
    // @arg clientId Unique Id of client
    // @return false if client does not exists, and an integer if it does indicating number of clients left
    public removeClient(
        clientId: string
    ): number {

        const index = this.clients.indexOf(clientId);

        if (index === -1) {
            throw(new Error('Client Id does not exist'));
        }

        this.clients.splice(index, 1);
        delete this.clientSockets[clientId];

        return this.clients.length;
    }

    // (async)
    // Broadcast message to room
    // @arg msgType Type of message
    // @arg message Message to send
    // @arg cb Callback function
    public broadcast(
        msgType: string,
        message: string,
        cb?: CallbackType
    ) {
        Object.keys(this.clientActiveMap).forEach(
            (clientId) => {
                if (this.clientActiveMap.hasOwnProperty(clientId) &&
                    this.clientActiveMap[clientId] === true) {

                    this.sendMessage(clientId,
                                     'room-broadcast',
                                     {
                                         messageType: msgType,
                                         message: message
                                     });
                }
            });

        // todo: proper callback
        cb(null, true);
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

}

export default Room;
