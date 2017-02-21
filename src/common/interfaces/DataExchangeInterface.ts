/**
 * DataExchangeInterface.ts
 */

import {
    CreateRoomReturnPacketType,
    GetRuleReturnPacketType,
    ReturnPacketType,
    PacketType,
    CallbackType
} from './PacketInterfaces';

export interface ClientDataExchangeInterface {
    host(ruleName: string, cb?: CallbackType<CreateRoomReturnPacketType>);
    join(roomId: string, cb?: CallbackType<GetRuleReturnPacketType>);
    rejoin(roomId: string, clientId: string, cb?: CallbackType<GetRuleReturnPacketType>);
    getRule(cb?: CallbackType<GetRuleReturnPacketType>);
    setView(clientId: string, displayName: string, props: any, cb?: CallbackType<ReturnPacketType>);
    execMethod(method: string, args: any, cb?: CallbackType<ReturnPacketType>);
    clientReady(cb?: CallbackType<ReturnPacketType>);
    onMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>);
    onJoinRoom(clientId: string);
    onRejoinRoom(clientId: string);
    onLeaveRoom(clientId: string);
}
