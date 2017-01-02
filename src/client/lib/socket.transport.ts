/**
 *
 * socket.transport.ts (client).
 *
 * Uses socket.io to implement the transport layer.
 *
 */

import Session from './session';

import {CallbackType,
        PacketType,
        ReturnPacketType} from '../../common/types';

import {isFunction} from '../../common/utils';

import {checkReturnMessage,
        forwardReturnMessage} from '../../common/messages';

export class SocketTransport {
    private socket: any;
    private clientId: string;
    private session: Session;

    constructor(
        io: any,
        uri: string,
        cb?: (data: ReturnPacketType) => any
    ) {
        this.socket = io.connect(uri,
                                 {
                                     'reconnect': true,
                                     'reconnection delay': 200,
                                     'force new connection': true
                                 });

        this.socket.on('message',
                       (data: PacketType, fn: CallbackType) => {
                           this.onMessage(data, fn);
                       });

        this.socket.emit('initialize',
                         {},
                         (data) => {
                             checkReturnMessage(data, 'clientId');
                             this.clientId = data.message;

                             return forwardReturnMessage(data, cb);
                         });
    }

    private onMessage(
        data: PacketType,
        cb: CallbackType
    ) {
        this.session.onMessage(data, cb);
    }

    public getClientId() {
        return this.clientId;
    }

    public waitForConnection(timeoutInMs: number) {
        let timeout = false;

        const timer = setTimeout(() => {
            timeout = true;
        }, timeoutInMs);

        while (this.getClientId() === undefined) {
            if (timeout) {
                throw 'Connection timed-out';
            }
        }

        clearTimeout(timer);

        return true;
    }

    public sendMessage(message: PacketType, cb?: CallbackType) {

        message.transport = {};

        this.socket.emit('message',
                         message,
                         cb);

    }

    public setSession(session: Session) {
        if (this.session === undefined) {
            this.session = session;
        } else {
            throw('Session has already been set for this transport object');
        }
    }
}

export default SocketTransport;
