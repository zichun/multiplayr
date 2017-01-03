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

import Session from './session';
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

export class DataExchange {
    private session: Session;
    private gameObj: any;
    private ruleName: string;

    constructor(
        session: Session
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
        data: PacketType,
        fn?: CallbackType
    ) {
        if (!data.dxc || !data.dxc.action) {
            return returnError(fn, 'invalid data packet (missing dxc key).');
        }

        switch (data.dxc.action) {

        case DataExchangeMessageType.ClientReady:
            return this.serviceClientReady(data, fn);

        case DataExchangeMessageType.ExecMethod:
            return this.serviceExecMethod(data, fn);

        case DataExchangeMessageType.SetView:
            return this.serviceSetView(data, fn);

        case DataExchangeMessageType.GetRule:
            if (!this.session.isHost()) {
                return returnError(fn, 'Non-host clients cannot service GetRule request.');
            }
            return returnSuccess(fn, 'rule', this.ruleName);
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
        data: PacketType,
        fn?: CallbackType
    ) {
        if (!this.session.isHost()) {
            return returnError(fn, 'Non-host clients cannot service ClientReady notifications.');
        } else if (!data.session || !data.session.fromClientId) {
            return returnError(fn, 'invalid data packet (missing session.fromClientId key).');
        }

        const clientId = data.session.fromClientId;

        return this.gameObj.clientIsReady(clientId);
    }

    private serviceExecMethod(
        data: PacketType,
        fn?: CallbackType
    ) {
        if (!this.session.isHost()) {
            return returnError(fn, 'Non-host clients cannot service ExecMethod request.');
        } else if (!data.dxc || !data.dxc.execMethodProp) {
            return returnError(fn, 'invalid data packet (missing dxc.execMethodProp key).');
        } else if (!data.session || !data.session.fromClientId) {
            return returnError(fn, 'invalid data packet (missing session.fromClientId key).');
        }

        const clientId = data.session.fromClientId;
        const method = data.dxc.execMethodProp.method;
        const args = data.dxc.execMethodProp.args;

        return this.gameObj.execMethod(clientId, method, args);
    }

    private serviceSetView(
        data: PacketType,
        fn?: CallbackType
    ) {
        if (this.session.isHost()) {
            return returnError(fn, 'Host cannot service SetView request.');
        } else if (!data.dxc || !data.dxc.setViewProp) {
            return returnError(fn, 'invalid data packet (missing dxc.setViewProp key).');
        }

        const displayName = data.dxc.setViewProp.displayName;
        const props = data.dxc.setViewProp.props;

        return this.gameObj.hostSetView(this.session.getClientId(),
                                        displayName,
                                        props,
                                        this.gameObj.container,
                                        fn);
    }

}

export default DataExchange;
