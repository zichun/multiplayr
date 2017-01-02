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

    public join(
        roomId: string,
        cb?: CallbackType
    ) {
        this.session.joinRoom(roomId, (res) => {

            checkReturnMessage(res, 'hostId');
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

// var MPDataExchange = (function() {
//     function MPDataExchange(comm, gameObj, namespace) {
//         var self = this;

//         self.execMethod = function(clientId, method, arguments) {
//             var hostId = comm.getHost();
//             sendTypedMessage(hostId,
//                              'exec-method',
//                              {
//                                  clientId: clientId,
//                                  method: method,
//                                  arguments: Array.prototype.slice.call(arguments, [])
//                              });
//         };

//         self.getData = function(clientId, variable, cb) {
//             if (clientId === null) {
//                 clientId = comm.getHost();
//             }

//             var mcb = function(err, data) {
//                 if (err) {
//                     return cb(err, data);
//                 }

//                 cb(err, data.data);
//             };

//             sendTypedMessage(comm.getHost(),
//                              'get-data',
//                              {
//                                  clientId: clientId,
//                                  variable: variable
//                              },
//                              mcb);
//         };

//         self.setData = function(clientId, variable, value, cb) {
//             if (clientId === null) {
//                 clientId = comm.getHost();
//             }
//             sendTypedMessage(comm.getHost(),
//                              'set-data',
//                              {
//                                  clientId: clientId,
//                                  variable: variable,
//                                  value: value
//                              },
//                              cb);
//         };

//         self.setView = function(clientId, displayName, props, cb) {
//             sendTypedMessage(clientId,
//                              'set-view',
//                              {
//                                  displayName: displayName,
//                                  props: props
//                              },
//                              cb);
//         };

//         self._typedMessages = {};

//         function sendTypedMessage(to, type, message, cb) {
//             var uniqid = gen_uniqid('dxc-ack');

//             if (cb && isFunction(cb)) {
//                 self._typedMessages[uniqid] = cb;
//             }

//             comm.send(to, {
//                 messageType: type,
//                 message: message,
//                 uniqid: uniqid,
//                 namespace: namespace
//             });
//         }

//         function sendAckMessage(to, uniqid, err, message) {
//             comm.send(to, {
//                 messageType: 'typed-message-ack',
//                 message: {
//                     err: err,
//                     data: message
//                 },
//                 uniqid: uniqid,
//                 namespace: namespace
//             });
//         }

//         /**
//          * Set-up events
//          */
//         comm.on('message', function(obj) {
//             var incomingNamespace = obj.message.namespace;
//             if (incomingNamespace !== namespace) {
//                 // wrong namespace. ignore
//                 return;
//             }
//             var from = obj.fromClientId;
//             var type = obj.message.messageType;
//             var message = obj.message.message;
//             var uniqid = obj.message.uniqid;
//             var ack = function(err, res) {
//                 sendAckMessage(from, uniqid, err, res);
//             };

//             switch(type) {
//                 case 'exec-method':
//                 {
//                     var clientId = message.clientId;
//                     var method = message.method;
//                     var arguments = message.arguments;

//                     if (gameObj.clientId !== comm.getHost()) {
//                         throw(new Error("Only host should be invoking methods"));
//                     }

//                     gameObj.__execMethod(clientId, method, arguments);

//                     break;
//                 }

//                 case 'typed-message-ack':
//                 {
//                     if (typeof self._typedMessages[uniqid] === 'undefined') {
//                         // ignore
//                         break;
//                     }

//                     var cb = self._typedMessages[uniqid];
//                     cb(message.err, message.data);
//                     delete self._typedMessages[uniqid];

//                 }
//                 break;

//                 case 'set-view':
//                 {
//                     var displayName = message.displayName;
//                     var props = message.props;
//                     var err = null;

//                     gameObj.__setView(gameObj.clientId, displayName, props, gameObj.__container, ack);
//                 }
//                 break;
//             }
//         });

//         comm.on('join-game', function(data) {
//             gameObj.newClient(data);
//         });
//         comm.on('leave-game', function(data) {
//             gameObj.disconnectClient(data);
//         });
//         comm.on('rejoin-game', function(data) {
//             gameObj.rejoinClient(data);
//         });

//         return self;
//     };

//     return MPDataExchange;
// })();
