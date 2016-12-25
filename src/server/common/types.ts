/**
 *
 * types.ts
 *
 * Export types for the service.
 *
 */

export type CallbackType = (err: string, res: any) => any;
export type SocketIoCallbackType = (x: any) => any;

export type RoomMessageType = {
    message: string,
    fromClientId?: string,
    messageType?: string
    toClientId?: string
};

export type JoinRoomType = {
    roomId: string,
    clientId: string
};
