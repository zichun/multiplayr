/**
 *
 * local.transport.ts (client).
 *
 * Have a local transport layer. Host and all clients will run on the same browser session.
 *
 */

import {
    returnSuccess,
    checkReturnMessage
} from '../../common/messages';

import {
    CallbackType,
    PacketType,
    ReturnPacketType,
    ClientTransportInterface,
    ClientSessionInterface,
    ServerTransportInterface,
    ServerSessionInterface
} from '../../common/interfaces';

import Session from '../../server/session';

export class LocalClientTransport implements ClientTransportInterface {
    private clientId: string;
    private session: ClientSessionInterface;
    private serverTransport: LocalServerTransport;

    constructor(
        cb?: (packet: ReturnPacketType) => any
    ) {
        this.serverTransport = new LocalServerTransport(this, (res) => {
            if (!checkReturnMessage(res, 'clientId')) {
                return;
            }

            this.clientId = res.message;
        });
    }

    public getClientId() {
        return this.clientId;
    }

    public updateClientId() {
        this.clientId = this.session.getClientId();
    }

    public sendMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>) {
        this.serverTransport.onMessage(packet, cb);
    }

    public onMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>) {
        this.session.onMessage(packet, cb);
    }

    public setSession(session: ClientSessionInterface) {
        this.session = session;
    }
}

class LocalServerTransport implements ServerTransportInterface {
    private session: ServerSessionInterface;
    private clientTransport: LocalClientTransport;

    constructor(
        clientTransport: LocalClientTransport,
        cb?: CallbackType<ReturnPacketType>
    ) {
        this.session = new Session(this);
        this.clientTransport = clientTransport;
        returnSuccess(cb, 'clientId', this.session.getClientId());
    }

    public onMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>) {
        this.session.onMessage(packet, cb);
    }

    public sendMessage(
        packet: PacketType,
        cb?: CallbackType<ReturnPacketType>
    ) {
        this.clientTransport.onMessage(packet, cb);
    }
}

export default LocalClientTransport;
