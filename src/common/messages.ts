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
    fn: CallbackType,
    errorMessage: string
) {
    const returnMessage = createReturnMessage(false,
                                              'error',
                                              errorMessage);
    console.error(errorMessage);

    if (isFunction(fn)) {
        fn(returnMessage);
    }
}

export function returnSuccess(
    fn: CallbackType,
    messageType: string,
    message: any
) {
    const returnMessage = createReturnMessage(true,
                                              messageType,
                                              message);
    if (isFunction(fn)) {
        fn(returnMessage);
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
    messageType?: string
) {
    if (!data || !data.messageType) {
        throw('Invalid data returned');
    }

    if (!data.success) {
        throw(data.message);
    }

    if (messageType && data.messageType !== messageType) {
        throw('Invalid data message type returned');
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
