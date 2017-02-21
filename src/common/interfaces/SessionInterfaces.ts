/**
 * SessionInterfaces.ts
 */

import {
    ReturnPacketType,
    JoinRoomReturnPacketType,
    CreateRoomReturnPacketType,
    CallbackType,
    PacketType
} from './PacketInterfaces';

export interface ClientSessionInterface {
    /**
     * @method createRoom
     *
     * Creates a new room. On success, callback will be called with the
     * roomId. The client that created the room will be the host of the room.
     */
    createRoom(cb?: CallbackType<CreateRoomReturnPacketType>);

    /**
     * @method joinRoom
     *
     * Joins a room. On success, callback will be called with the hostId.
     */
    joinRoom(roomId: string, cb?: CallbackType<JoinRoomReturnPacketType>);

    /**
     * @method rejoinRoom
     *
     * Rejoins a room as a given clientId. This is for the purpose of reconnection.
     * On success, callback will be called with the hostId.
     */
    rejoinRoom(roomId: string, clientId: string, cb?: CallbackType<JoinRoomReturnPacketType>);

    /**
     * @method sendMessage
     *
     * Sends a packet to a given client.
     */
    sendMessage(clientId: string, packet: PacketType, cb?: CallbackType<ReturnPacketType>);

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
    onMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>);

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
        onMessage?: (packet: PacketType, cb?: CallbackType<ReturnPacketType>) => void,
        onJoinRoom?: (clientId: string) => void,
        onRejoinRoom?: (clientId: string) => void,
        onLeaveRoom?: (clientId: string) => void,
        onReconnect?: () => void
    });

    getClientId(): string;
    getRoomId(): string;
    getHostId(): string;
    isHost(): boolean;
}

export interface ServerSessionInterface {
    reconnect(roomId: string, clientId: string, cb?: CallbackType<ReturnPacketType>);
    sendMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>);
    onMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>);
    onDisconnect(cb?: CallbackType<ReturnPacketType>);
    getClientId();
}
