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
    /**
     * @method createRoom
     *
     * Creates a new room. On success, callback will be called with the
     * roomId. The client that created the room will be the host of the room.
     */
    createRoom(cb?: CallbackType);

    /**
     * @method joinRoom
     *
     * Joins a room. On success, callback will be called with the hostId.
     */
    joinRoom(roomId: string, cb?: CallbackType);

    /**
     * @method rejoinRoom
     *
     * Rejoins a room as a given clientId. This is for the purpose of reconnection.
     * On success, callback will be called with the hostId.
     */
    rejoinRoom(roomId: string, clientId: string, cb?: CallbackType);

    /**
     * @method sendMessage
     *
     * Sends a packet to a given client.
     */
    sendMessage(clientId: string, packet: PacketType, cb?: CallbackType);

    /**
     * @method onReconnect
     *
     * This is callback for the transport layer when the transport reconnected.
     */
    onReconnect();

    /**
     * @method onMessage
     *
     * This is a callback for the transport layer when a new message is received.
     */
    onMessage(packet: PacketType, cb?: CallbackType);

    /**
     * @method setCallbacks
     *
     * Sets the respective callbacks for the following events:
     *     onMessage - Callback for when transport layer receives a new message
     *     onJoinRoom - Callback for when a new client connected to the room
     *     onRejoinRoom - Callback for when a (disconnected) client rejoins the room
     *     onLeaveRoom - Callback for when a client leaves the room (disconnected)
     *     onReconnect - Callback for when the transport layer reconnects
     */
    setCallbacks(callBacks: {
        onMessage?: (packet: PacketType, cb?: CallbackType) => void,
        onJoinRoom?: (clientId: string) => void,
        onRejoinRoom?: (clientId: string) => void,
        onLeaveRoom?: (clientId: string) => void,
        onReconnect?: () => void
    });

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
    onDataChange(mp: MPType, rule?: GameRuleInterface): boolean;
    methods: {[methodName: string]: (mb: any, clientId: string, ...args: any[]) => any};
    views: { [viewName: string]: any };
}

export interface ViewPropsInterface {
    MP: MPType
}
