/**
 *
 * socket.transport.ts (client).
 *
 * Uses socket.io to implement the transport layer.
 *
 */

import { isFunction } from '../../common/utils';

import {
    checkReturnMessage,
    forwardReturnMessage
} from '../../common/messages';

import {
    CallbackType,
    PacketType,
    ReturnPacketType,
    ClientTransportInterface,
    ClientSessionInterface
} from '../../common/interfaces';

export class SocketTransport implements ClientTransportInterface {
    private socket: any;
    private clientId: string;
    private session: ClientSessionInterface;

    constructor(
        conn: any,
        cb?: (packet: ReturnPacketType) => any
    ) {
        this.socket = conn.io.connect(conn.uri,
                                      {
                                          'reconnect': true,
                                          'reconnection delay': 200,
                                          'force new connection': true
                                      });

        this.socket.on('message',
                       (packet: PacketType, cb: CallbackType<ReturnPacketType>) => {
                           this.onMessage(packet, cb);
                       });

        this.initializeTransport(cb);

        this.socket.on('reconnect', (data: any) => {
            if (this.session && this.session.getRoomId()) {
                this.reconnectTransport();
            } else {
                this.initializeTransport();
            }
        });
    }

    public getClientId() {
        return this.clientId;
    }

    public updateClientId() {
        this.clientId = this.session.getClientId();
    }

    public sendMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>) {

        packet.transport = {};

        this.socket.emit('message',
                         packet,
                         cb);

    }

    public setSession(session: ClientSessionInterface) {
        this.session = session;
    }

    private reconnectTransport() {
        this.socket.emit('rejoin',
                         {
                             roomId: this.session.getRoomId(),
                             clientId: this.clientId
                         },
                         (data) => {
                             if (!checkReturnMessage(data, 'reconnect')) {
                                 return;
                             }
                             this.session.onReconnect();
                         });
    }

    private initializeTransport(
        cb?: CallbackType<ReturnPacketType>
    ) {
        this.socket.emit('initialize',
                         {},
                         (data) => {
                             if (!checkReturnMessage(data, 'clientId', cb)) {
                                 return;
                             }
                             this.clientId = data.message;

                             return forwardReturnMessage(data, cb);
                         });
    }

    private onMessage(
        packet: PacketType,
        cb: CallbackType<ReturnPacketType>
    ) {
        this.session.onMessage(packet, cb);
    }
}

export default SocketTransport;
