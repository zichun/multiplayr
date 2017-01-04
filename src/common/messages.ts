/**
 * Messages.ts
 *
 * Defines helper functions for message passing between interfaces.
 */

import {isFunction} from './utils';

import {CallbackType,
        ReturnPacketType,
        PacketType,
        SessionMessageType,
        RoomMessageType,
        DataExchangeMessageType} from './types';

export function returnError(
    cb: CallbackType,
    errorMessage: string
) {
    const returnMessage = createReturnMessage(false,
                                              'error',
                                              errorMessage);
    console.error(errorMessage);

    if (isFunction(cb)) {
        cb(returnMessage);
    }
}

export function returnSuccess(
    cb: CallbackType,
    messageType: string,
    message: any
) {
    const returnMessage = createReturnMessage(true,
                                              messageType,
                                              message);
    if (isFunction(cb)) {
        cb(returnMessage);
    }
}

export function createReturnMessage(
    success: boolean,
    messageType: string,
    message: any
): ReturnPacketType {

    return {
        success: success,
        messageType: messageType,
        message: message
    };
}

export function forwardReturnMessage(
    data: ReturnPacketType,
    cb?: CallbackType
) {
    return isFunction(cb) && cb(data);
}

export function checkReturnMessage(
    data: ReturnPacketType,
    messageType?: string,
    cb?: CallbackType
) {
    const ret = (msg) => {
        if (cb) {
            return forwardReturnMessage(data, cb);
        }

        throw(msg);
    };

    if (!data || !data.messageType) {
        return ret('Invalid data returned');
    }

    if (!data.success) {
        return ret(data.message);
    }

    if (messageType && data.messageType !== messageType) {
        return ret('Invalid data message type returned');
    }
}

export function createSessionPacket(
    action: SessionMessageType,
    toClientId?: string,
    fromClientId?: string
): PacketType {

    const packet: PacketType = {
        session: {
            action: action
        }
    };

    if (toClientId) {
        packet.session.toClientId = toClientId;
    }

    if (fromClientId) {
        packet.session.fromClientId = fromClientId;
    }

    return packet;
}

export function createRoomPacket(
    action: RoomMessageType,
    clientId: string
): PacketType {

    return {
        room: {
            action: action,
            clientId: clientId
        }
    };
}

export function createDataExchangeExecMethodPacket(
    method: string,
    args: any
): PacketType {
    return {
        dxc: {
            action: DataExchangeMessageType.ExecMethod,
            execMethodProp: {
                method: method,
                args: args
            }
        }
    };
}

export function createDataExchangeClientReadyPacket(
): PacketType {
    return {
        dxc: {
            action: DataExchangeMessageType.ClientReady
        }
    };
}

export function createDataExchangeSetViewPacket(
    displayName: string,
    props: any
): PacketType {
    return {
        dxc: {
            action: DataExchangeMessageType.SetView,
            setViewProp: {
                displayName: displayName,
                props: props
            }
        }
    };
}

export function createDataExchangeGetRulePacket(
): PacketType {
    return {
        dxc: {
            action: DataExchangeMessageType.GetRule
        }
    };
}
