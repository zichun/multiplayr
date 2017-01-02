/**
 *
 * types.ts
 *
 * Export types for the service.
 *
 */

export type ReturnPacketType = {
    success: boolean,
    messageType: string,
    message: any
}

export type CallbackType = (res: ReturnPacketType) => any;

export type JoinRoomType = {
    roomId: string,
    clientId: string
}

//
// Packet Types - Packets are the object that is sent in between
// the communication layers. Each layer (transport/session/room/dxc) can
// add in metadata via subkeys in the packet.
//

export type PacketType = {
    transport?: TransportSubPacketType,
    session?: SessionSubPacketType
    room?: RoomSubPacketType,
    dxc?: DataExchangePacketType
}

export type TransportSubPacketType = {
}

export type SessionSubPacketType = {
    action: SessionMessageType,
    roomId?: string,
    toClientId?: string,
    fromClientId?: string
}

export type RoomSubPacketType = {
    action: RoomMessageType,
    clientId: string
}

export type DataExchangePacketType = {
    action: DataExchangeMessageType,
    execMethodProp?: {
        method: string,
        args: any
    },
    setViewProp?: {
        displayName: string,
        props: any
    }
}

export enum SessionMessageType {
    CreateRoom = 1, // client wants to create a new room.
    JoinRoom,       // client wants to join a room.
    SendMessage,    // client wants to send a message to another client.
    RoomBroadcast   // a broadcast is being emitted from the server.
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

//
// Gameobject types
//

export type DataStoreType = (variable: string) => {
    getValue: () => any,
    setValue: (value: any) => any
};
