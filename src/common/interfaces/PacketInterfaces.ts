/**
 *
 * PacketInterfaces.ts
 *
 * Interfaces for packets used in the message passing protocol.
 *
 */

//
// Packet Types - Packets are the object that is sent in between
// the communication layers. Each layer (transport/session/room/dxc) can
// add in metadata via subkeys in the main packet object (PacketType).
//

export interface PacketType {
    transport?: TransportSubPacketType;
    session?: SessionSubPacketType;
    room?: RoomSubPacketType;
    dxc?: DataExchangeSubPacketType;
}

export interface TransportSubPacketType {
}

export interface SessionSubPacketType {
    action: SessionMessageType;
    roomId?: string;
    toClientId?: string;
    fromClientId?: string;
}

export interface RoomSubPacketType {
    action: RoomMessageType;
    clientId: string;
}

export interface DataExchangeSubPacketType {
    action: DataExchangeMessageType;
    execMethodProp?: {
        method: string;
        args: any;
    };
    setViewProp?: {
        displayName: string;
        props: any;
    };
}

export enum SessionMessageType {
    CreateRoom = 1, // client wants to create a new room.
    JoinRoom,       // client wants to join a room.
    SendMessage,    // client wants to send a message to another client.
    RoomBroadcast,  // a broadcast is being emitted from the server.
    RejoinRoom      // client wants to rejoin a room
}

export enum RoomMessageType {
    JoinRoom = 1,   // notifies that a new client has joined the room.
    RejoinRoom,     // notifies that a client has reconnected to the room.
    LeaveRoom       // notifies that a client has left the room.
}

export enum DataExchangeMessageType {
    ExecMethod = 1, // Clients initiate an execute-method on the host
    SetView,        // Host sets the view on the client
    GetRule,        // Get loaded rule from host
    ClientReady     // Client notifies host that rule has been loaded
}

export interface JoinRoomType {
    roomId: string;
    clientId: string;
}

export interface ReconnectPacketType {
    roomId: string;
    clientId: string;
}

//
// Each callback will be given a return packet (with base type ReturnPacketType).
//

export interface ReturnPacketType {
    success: boolean;
    messageType: string;
    message?: any;
}

export interface JoinRoomReturnPacketType extends ReturnPacketType {
    hostId?: string;
}

export interface CreateRoomReturnPacketType extends ReturnPacketType {
    roomId?: string;
}

export interface GetRuleReturnPacketType extends ReturnPacketType {
    rule?: string;
}

export interface CallbackType<T> {
    (res: T): any;
}
