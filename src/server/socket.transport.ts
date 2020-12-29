/**
 *
 * socket.transport.ts (server).
 *
 * Uses socket.io to implement the transport layer.
 *
 */

import { Session } from './session';

import { isFunction } from '../common/utils';

import {
    returnError,
    returnSuccess,
    forwardReturnMessage
} from '../common/messages';

import {
    ReturnPacketType,
    CallbackType,
    JoinRoomType,
    RoomMessageType,
    PacketType,
    ReconnectPacketType,
    ServerTransportInterface,
    ServerSessionInterface
} from '../common/interfaces';

export class SocketTransport implements ServerTransportInterface {
    private socket: any;
    private session: ServerSessionInterface = null;
    private initialized: boolean;

    constructor(socket: any) {
        this.initialized = false;
        this.socket = socket;
        this.initialize();
    }

    private initialize() {

        this.socket.on('initialize',
            (data: any, cb: CallbackType<ReturnPacketType>) => {

                if (this.initialized) {
                    return returnError(
                        cb,
                        'transport has already been initialized (clientId: ' + this.session.getClientId() + ')');
                }

                this.session = new Session(this);
                this.initialized = true;

                console.log('New client connected: ' + this.session.getClientId());

                return returnSuccess(cb, 'clientId', this.session.getClientId());
            });

        this.socket.on(
            'rejoin',
            (data: ReconnectPacketType, cb: CallbackType<ReturnPacketType>) => {
                // todo: handle reconnection logic
                if (this.session || this.initialized) {
                    return returnError(
                        cb,
                        'transport has already been initialized, cannot rejoin (clientId: ' +
                        this.session.getClientId() + ')');
                }

                if (!data.roomId || !data.clientId) {
                    return returnError(
                        cb,
                        'invalid reconnection packet (missing data.roomId/clientId)');
                }

                this.initialized = true;
                this.session = new Session(this);
                this.session.reconnect(
                    data.roomId,
                    data.clientId,
                    (res) => {
                        if (res.success === false) {
                            this.session = null;
                            this.initialized = false;
                        } else {
                            console.log('Transport[' + data.clientId + '] successfully reconnected to Room[' + data.roomId + ']');
                        }

                        return forwardReturnMessage(res, cb);
                    });
            });

        this.socket.on(
            'message',
            (packet: PacketType, cb: CallbackType<ReturnPacketType>) => {

                if (!this.initialized) {
                    return returnError(cb, 'transport session has not been initialized');
                }

                if (packet.transport === undefined) {
                    return returnError(cb, 'invalid data packet (missing transport key)');
                }

                this.session.onMessage(packet, cb);
            });

        this.socket.on(
            'disconnect',
            () => {
                if (this.initialized) {
                    console.log('Client disconnected: ' + this.session.getClientId());
                    this.session.onDisconnect();

                    this.initialized = false;
                    this.session = null;
                }
            });
    }

    public sendMessage(
        packet: PacketType,
        cb?: CallbackType<ReturnPacketType>) {

        this.socket.emit(
            'message',
            packet,
            cb);
    }
}

export default SocketTransport;
