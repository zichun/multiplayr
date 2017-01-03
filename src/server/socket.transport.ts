/**
 *
 * socket.transport.ts (server).
 *
 * Uses socket.io to implement the transport layer.
 *
 */

import Rooms from './rooms';
import Session from './session';

import {isFunction} from '../common/utils';

import {CallbackType,
        JoinRoomType,
        RoomMessageType,
        PacketType,
        ReconnectPacketType} from '../common/types';

import {returnError,
        returnSuccess,
        forwardReturnMessage} from '../common/messages';

export class SocketTransport {
    private socket: any;
    private session: Session = null;
    private initialized: boolean;

    constructor(socket: any) {
        this.initialized = false;
        this.socket = socket;
        this.initialize();
    }

    private initialize() {

        this.socket.on('initialize',
                       (data: any, fn: CallbackType) => {

                           if (this.initialized) {
                               return returnError(fn,
                                                  'transport has already been initialized (clientId: ' + this.session.getClientId() + ')');
                           }

                           this.session = new Session(this);
                           this.initialized = true;

                           console.log('New client connected: ' + this.session.getClientId());

                           return returnSuccess(fn, 'clientId', this.session.getClientId());
                       });

        this.socket.on('rejoin',
                       (data: ReconnectPacketType, fn: CallbackType) => {
                           // todo: handle reconnection logic
                           if (this.session || this.initialized) {
                               return returnError(fn,
                                                  'transport has already been initialized, cannot rejoin (clientId: ' +
                                                  this.session.getClientId() + ')');
                           }

                           if (!data.roomId || !data.clientId) {
                               return returnError(fn,
                                                  'invalid reconnection packet (missing data.roomId/clientId)');
                           }

                           this.initialized = true;
                           this.session = new Session(this);
                           this.session.reconnect(data.roomId,
                                                  data.clientId,
                                                  (res) => {
                                                      if (res.success === false) {
                                                          this.session = null;
                                                          this.initialized = false;
                                                      }
                                                      return forwardReturnMessage(res, fn);
                                                  });
                       });

        this.socket.on('message',
                       (data: PacketType, fn: CallbackType) => {

                           if (!this.initialized) {
                               return returnError(fn, 'transport session has not been initialized');
                           }

                           if (data.transport === undefined) {
                               return returnError(fn, 'invalid data packet (missing transport key)');
                           }

                           this.session.onMessage(data, fn);
                       });

        this.socket.on('disconnect', () => {
            if (this.initialized) {
                console.log('Client disconnected: ' + this.session.getClientId());
                this.session.onDisconnect();

                this.initialized = false;
                this.session = null;
            }
        });
    }

    public sendMessage(
        data: PacketType,
        cb?: CallbackType
    ) {
        this.socket.emit('message',
                         data,
                         cb);
    }

    public static NEW_CONNECTION(socket: any) {
        const transport = new SocketTransport(socket)
    }
}

export default SocketTransport;
