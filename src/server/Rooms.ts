/**
 *
 * Room.ts
 *
 * Implemenetation of Rooms class.
 *
 */

import Room from './Room.js';
import Session from './session';

import * as constants from '../common/constants';

import {randomRoomId,
        uniqueId} from '../common/utils';

import {returnError} from '../common/messages';

import {CallbackType} from '../common/types';

export class Rooms {
    private rooms: {[key: string]: Room};
    private clientsRoomMap: {[key: string]: string};
    private roomCleanupTimer: {[key: string]: any};

    constructor() {
        this.rooms = {};
        this.clientsRoomMap = {};
        this.roomCleanupTimer = {};
    }

    public create(
        clientId: string,
        session: Session
    ): Room {
        let uniqid = '';

        do {
            uniqid = randomRoomId();
        } while (this.rooms[uniqid]);

        this.rooms[uniqid] = new Room(uniqid);
        this.rooms[uniqid].addClient(clientId, session);

        this.clientsRoomMap[clientId] = uniqid;

        return this.rooms[uniqid];
    }

    public hasRoom(
        room: string
    ): boolean {
        let found = false;

        Object.keys(this.rooms).forEach(
            (rooms) => {
                if (rooms === room) {
                    found = true;
                }
            });

        return found;
    }

    public getClientRoom(
        clientId: string
    ) : string {
        if (this.clientsRoomMap[clientId] === undefined) {
            throw(new Error('Client Id does not exist'));
        }

        return this.clientsRoomMap[clientId];
    }

    public deleteRoom(
        roomId: string
    ): void {
        console.log('Deleting Room[' + roomId + ']');

        const clients = this.rooms[roomId].getAllClients();

        for (let i = 0; i < clients.length; i = i + 1) {
            if (this.clientsRoomMap.hasOwnProperty(clients[i])) {
                delete this.clientsRoomMap[clients[i]];
            }
        }

        delete this.rooms[roomId];
        delete this.roomCleanupTimer[roomId];
    }

    public unmarkRoomForCleanup(
        roomId: string
    ): boolean {

        if (this.hasRoom(roomId) === false) {
            throw(new Error('Room ' + roomId + ' does not exists.'));
        }

        if (this.roomCleanupTimer.hasOwnProperty(roomId)) {

            clearTimeout(this.roomCleanupTimer[roomId]);
            delete this.roomCleanupTimer[roomId];

            return true;
        }

        return false;
    }

    // Start a timer to mark the room for cleanup.
    // Whenever a new client joins, reset this timer.
    public markRoomForCleanup(
        roomId: string
    ) {
        if (this.hasRoom(roomId) === false) {
            throw(new Error('Room ' + roomId + ' does not exists.'));
        }

        if (!this.roomCleanupTimer[roomId]) {

            console.log('Marking ' + roomId + ' for deletion');

            this.roomCleanupTimer[roomId] = setTimeout(() => {
                this.deleteRoom(roomId);
            }, constants.ROOMINACTIVELIFESPAN);
        }

        return this.roomCleanupTimer[roomId];
    }

    // Disconnect a given client from the room management
    // @arg clientId Identifier of client
    public disconnectClient(
        clientId: string
    ): void {
        if (!this.clientsRoomMap[clientId]) {
            throw(new Error('Client Id does not exist'));
        }

        const roomId = this.getClientRoom(clientId);

        console.log('Client[' + clientId + '] disconnected from Room[' + roomId + ']');

        this.rooms[roomId].disconnectClient(clientId);
//        this.rooms[roomId].broadcast('leave-room', clientId);

        if (this.rooms[roomId].getClients().length === 0) {
            this.markRoomForCleanup(roomId);
        }
    }

    // Remove a given client from the room management. When client count hits 0, garbage collect room.
    // @arg clientId Identifier of client
    public removeClient(
        clientId: string
    ): void {
        if (!this.clientsRoomMap[clientId]) {
            throw(new Error('Client Id does not exist'));
        }

        const roomId = this.getClientRoom(clientId);
        const clientsLeft = this.rooms[roomId].removeClient(clientId);

        delete this.clientsRoomMap[clientId];

//        this.rooms[roomId].broadcast('leave-room', clientId);

        if (clientsLeft === 0) {
            this.deleteRoom(roomId);
        }
    }

    public getRooms(): string[] {
        const tr = [];

        Object.keys(this.rooms).forEach(
            (room) => {
                tr.push(room);
            });

        return tr;
    }

    public getClients(
        room: string
    ): string[] {

        if (this.hasRoom(room)) {
            return this.rooms[room].getClients();
        } else {
            throw(new Error('Room does not exists'));
        }
    }

    public reconnectClient(
        room: string,
        socket: any,
        clientId: string,
        socketioReconnect: boolean
    ): boolean {

        if (this.hasRoom(room) && this.clientsRoomMap[clientId] === room) {

            console.log('Client[' + clientId + '] reconnecting to Room[' + room + ']');

            const result = this.rooms[room].reconnectClient(clientId, socket, socketioReconnect);

            if (result) {
                this.unmarkRoomForCleanup(room);
            }

            return result;
        } else {
            throw(new Error('Room does not exists'));
        }
    }

    public addClient(
        roomId: string,
        session: Session
    ): Room {

        let clientId = '';

        if (this.hasRoom(roomId)) {
            clientId = session.getClientId();
            this.rooms[roomId].addClient(clientId, session);
            this.clientsRoomMap[clientId] = roomId;

            console.log('Client[' + clientId + '] joining Room[' + roomId + ']');

            this.unmarkRoomForCleanup(roomId);

            return this.rooms[roomId];
        } else {
            throw(new Error('Room ' + roomId + ' does not exists'));
        }
    }

    // public sendMessage(
    //     roomId: string,
    //     fromClientId: string,
    //     toClientId: string,
    //     message: string,
    //     cb?: CallbackType
    // ) {
    //     if (this.hasRoom(roomId)) {
    //         this.rooms[roomId].clientSendMessage(fromClientId,
    //                                            toClientId,
    //                                            message,
    //                                            cb);
    //     } else {
    //         return returnError(cb, 'Room ' + roomId + ' does not exist');
    //     }
    // };
}

export default Rooms;
