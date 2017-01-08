/**
 * interfaces.ts
 */

import {PacketType,
        CallbackType} from './types';

export interface ClientTransportInterface {
    getClientId(): string;
    updateClientId();
    sendMessage(packet: PacketType, cb?: CallbackType);
    setSession(session: ClientSessionInterface);
}

export interface ClientSessionInterface {
    createRoom(cb?: CallbackType);
    joinRoom(roomId: string, cb?: CallbackType);
    rejoinRoom(roomId: string, clientId: string, cb?: CallbackType);
    sendMessage(clientId: string, packet: PacketType, cb?: CallbackType);
    onMessage(packet: PacketType, cb?: CallbackType);
    setDxc(dxc: ClientDataExchangeInterface);
    getClientId();
    getRoomId();
    getHostId();
    isHost();
}

export interface ClientDataExchangeInterface {
    host(ruleName: string, cb?: CallbackType);
    join(roomId: string, cb?: CallbackType);
    rejoin(roomId: string, clientId: string, cb?: CallbackType);
    getRule(cb?: CallbackType);
    setView(clientId: string, displayName: string, props: any, cb?: CallbackType);
    execMethod(method: string, args: any, cb?: CallbackType);
    clientReady(cb?: CallbackType);
    onMessage(packet: PacketType, cb?: CallbackType);
    onJoinRoom(clientId: string);
    onRejoinRoom(clientId: string);
    onLeaveRoom(clientId: string);
}

export interface ServerTransportInterface {
    sendMessage(data: PacketType, cb?: CallbackType);
}

export interface ServerSessionInterface {
    reconnect(roomId: string, clientId: string, cb?: CallbackType);
    sendMessage(packet: PacketType, cb?: CallbackType);
    onMessage(packet: PacketType, cb?: CallbackType);
    onDisconnect(cb?: CallbackType);
    getClientId();
}

export type MPType = any;

export interface GameRuleInterface {
    name: string;
    css: string[];
    plugins: { [gameName: string]: GameRuleInterface };
    globalData: { [varName: string]: any };
    playerData: { [varName: string]: any };
    onDataChange(mp: MPType): boolean;
    methods: {[methodName: string]: (mb: any, clientId: string, ...args: any[]) => any};
    views: { [viewName: string]: any };
}

export interface ViewPropsInterface {
    MP: MPType
}
