/**
 * TransportInterfaces.ts
 */

import {
    ReturnPacketType,
    CallbackType,
    PacketType
} from './PacketInterfaces';

import {
    ClientSessionInterface
} from './SessionInterfaces';

export interface ClientTransportInterface {
    getClientId(): string;
    updateClientId();
    sendMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>);
    setSession(session: ClientSessionInterface);
}

export interface ServerTransportInterface {
    sendMessage(data: PacketType, cb?: CallbackType<ReturnPacketType>);
}
