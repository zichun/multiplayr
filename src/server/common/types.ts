/**
 *
 * types.ts
 *
 * Export types for the service.
 *
 */

export type CallbackType = (err: string, res: any) => any;

export type RoomMessageType = {
    message: string,
    fromClientId?: string,
    messageType?: string
};
