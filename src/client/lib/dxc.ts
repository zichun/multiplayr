/**
 *
 * dxc.ts
 *
 * Multiplayr is designed to be data-driven, and hence we only allow data exchange (dxc) in this intermediate protocol layer
 *
 * Data will only be stored and manipulated by the host. Clients will have no access to the data, and can only manipulate
 * the state via execMethod to the host.
 *
 * The host will recompute the desired views based on the new state, and pushes down the view via setView.
 *
 */

import GameObject from './gameobject';

import {DataExchangeMessageType,
        CallbackType,
        PacketType} from '../../common/types';

import {returnError,
        returnSuccess,
        forwardReturnMessage,
        checkReturnMessage,
        createDataExchangeSetViewPacket,
        createDataExchangeExecMethodPacket,
        createDataExchangeGetRulePacket,
        createDataExchangeClientReadyPacket} from '../../common/messages';

import {ClientDataExchangeInterface,
        ClientSessionInterface} from '../../common/interfaces';

export class DataExchange implements ClientDataExchangeInterface {
    private session: ClientSessionInterface;
    private gameObj: any;
    private ruleName: string;

    constructor(
        session: ClientSessionInterface
    ) {
        this.session = session;
        this.session.setDxc(this);
    }

    public host(
        ruleName: string,
        cb?: CallbackType
    ) {
        this.ruleName = ruleName;
        return this.session.createRoom(cb);
    }

    public rejoin(
        roomId: string,
        clientId: string,
        cb?: CallbackType
    ) {
        this.session.rejoinRoom(roomId, clientId, (res) => {
            if (!res.success) {
                return checkReturnMessage(res, 'hostId', cb);
            }
            return this.getRule(cb);
        });
    }

    public join(
        roomId: string,
        cb?: CallbackType
    ) {
        this.session.joinRoom(roomId, (res) => {
            if (!res.success) {
                return checkReturnMessage(res, 'hostId', cb);
            }
            return this.getRule(cb);
        });
    }

    public getRule(
        cb?: CallbackType
    ) {
        if (this.session.isHost()) {
            return returnError(cb, 'Host doesn\'t need to go through dxc layer to get the current loaded rule.');
        }

        const packet = createDataExchangeGetRulePacket();

        return this.session.sendMessage(this.session.getHostId(),
                                        packet,
                                        (res) => {
                                            checkReturnMessage(res, 'rule');

                                            this.ruleName = res.message;

                                            return forwardReturnMessage(res, cb);
                                        });
    }

    public setView(
        clientId: string,
        displayName: string,
        props: any,
        cb?: CallbackType
    ) {
        if (!this.session.isHost()) {
            return returnError(cb, 'Only host can set view.');
        }

        const packet = createDataExchangeSetViewPacket(displayName, props);

        return this.session.sendMessage(clientId, packet, cb);
    }

    public execMethod(
        method: string,
        args: any,
        cb?: CallbackType
    ) {
        if (this.session.isHost()) {
            return returnError(cb, 'Host doesn\'t need to go through dxc layer to execute methods.');
        }

        const arrayArgs = Array.prototype.slice.call(args, []);
        const packet = createDataExchangeExecMethodPacket(method, arrayArgs);

        return this.session.sendMessage(this.session.getHostId(), packet, cb);
    }

    public clientReady(
        cb?: CallbackType
    ) {
        if (this.session.isHost()) {
            return returnError(cb, 'Host doesn\'t need to notify that its ready.');
        }

        const packet = createDataExchangeClientReadyPacket();

        return this.session.sendMessage(this.session.getHostId(), packet, cb);
    }

    public onMessage(
        packet: PacketType,
        cb?: CallbackType
    ) {
        if (!packet.dxc || !packet.dxc.action) {
            return returnError(cb, 'invalid data packet (missing dxc key).');
        }

        switch (packet.dxc.action) {

        case DataExchangeMessageType.ClientReady:
            return this.serviceClientReady(packet, cb);

        case DataExchangeMessageType.ExecMethod:
            return this.serviceExecMethod(packet, cb);

        case DataExchangeMessageType.SetView:
            return this.serviceSetView(packet, cb);

        case DataExchangeMessageType.GetRule:
            if (!this.session.isHost()) {
                return returnError(cb, 'Non-host clients cannot service GetRule request.');
            }
            return returnSuccess(cb, 'rule', this.ruleName);
        }
    }

    public setGameObject(
        gameObj: GameObject
    ) {
        if (this.gameObj === undefined) {
            this.gameObj = gameObj;
        } else {
            throw('GameObject has already been set for this dxc object');
        }
    }

    public onJoinRoom(
        clientId: string
    ) {
        if (this.session.isHost()) {
            this.gameObj.addNewClient(clientId);
        }
    }

    public onRejoinRoom(
        clientId: string
    ) {
        if (this.session.isHost()) {
            this.gameObj.rejoinClient(clientId);
        }
    }

    public onLeaveRoom(
        clientId: string
    ) {
        if (this.session.isHost()) {
            this.gameObj.disconnectClient(clientId);
        }
    }

    private serviceClientReady(
        packet: PacketType,
        cb?: CallbackType
    ) {
        if (!this.session.isHost()) {
            return returnError(cb, 'Non-host clients cannot service ClientReady notifications.');
        } else if (!packet.session || !packet.session.fromClientId) {
            return returnError(cb, 'invalid data packet (missing session.fromClientId key).');
        }

        const clientId = packet.session.fromClientId;

        return this.gameObj.clientIsReady(clientId);
    }

    private serviceExecMethod(
        packet: PacketType,
        cb?: CallbackType
    ) {
        if (!this.session.isHost()) {
            return returnError(cb, 'Non-host clients cannot service ExecMethod request.');
        } else if (!packet.dxc || !packet.dxc.execMethodProp) {
            return returnError(cb, 'invalid data packet (missing dxc.execMethodProp key).');
        } else if (!packet.session || !packet.session.fromClientId) {
            return returnError(cb, 'invalid data packet (missing session.fromClientId key).');
        }

        const clientId = packet.session.fromClientId;
        const method = packet.dxc.execMethodProp.method;
        const args = packet.dxc.execMethodProp.args;

        return this.gameObj.execMethod(clientId, method, args);
    }

    private serviceSetView(
        packet: PacketType,
        cb?: CallbackType
    ) {
        if (this.session.isHost()) {
            return returnError(cb, 'Host cannot service SetView request.');
        } else if (!packet.dxc || !packet.dxc.setViewProp) {
            return returnError(cb, 'invalid data packet (missing dxc.setViewProp key).');
        }

        const displayName = packet.dxc.setViewProp.displayName;
        const props = packet.dxc.setViewProp.props;

        return this.gameObj.hostSetView(this.session.getClientId(),
                                        displayName,
                                        props,
                                        this.gameObj.container,
                                        cb);
    }

}

export default DataExchange;
