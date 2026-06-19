/**
 * webrtc.transport.ts (client).
 *
 * Implements WebRTC transport using PeerJS library.
 * Emulates the room management server-side logic in a static, host-centric star topology.
 */

import { isFunction, uniqueId } from '../../common/utils';
import {
    checkReturnMessage,
    forwardReturnMessage,
    returnSuccess,
    returnError,
    createReturnMessage
} from '../../common/messages';

import {
    CallbackType,
    PacketType,
    ReturnPacketType,
    ClientTransportInterface,
    ClientSessionInterface,
    SessionMessageType,
    RoomMessageType
} from '../../common/interfaces';

declare const Peer: any;

export class WebRTCTransport implements ClientTransportInterface {
    private peer: any;
    private clientId: string;
    private roomId: string;
    private session: ClientSessionInterface;

    // For Host: Maps clientIds to their active PeerJS connection objects
    private connections: { [clientId: string]: any } = {};

    // For Client: Direct connection to the host
    private hostConnection: any = null;
    private hostConnected = false;
    private kicked = false;

    // Callbacks for local or remote async replies
    private pendingCallbacks: { [packetId: string]: CallbackType<ReturnPacketType> } = {};

    // Reconnection state
    private isReconnecting = false;
    private reconnectTimeout: any = null;
    private options: { roomId?: string; customPeerId?: string; iceServers?: any[] };
    private initialCallback?: (packet: ReturnPacketType) => any;
    private heartbeatInterval: any = null;
    private recreateTimeout: any = null;

    constructor(
        options: { roomId?: string; customPeerId?: string; iceServers?: any[] },
        cb?: (packet: ReturnPacketType) => any
    ) {
        this.options = options;
        this.initialCallback = cb;
        // Generate a unique client identifier (short P2P ID format: mp-XXXXXX)
        this.clientId = options.customPeerId || ('mp-' + Math.floor(100000 + Math.random() * 900000).toString());
        this.roomId = options.roomId ? (options.roomId.startsWith('mp-') ? options.roomId : 'mp-' + options.roomId) : undefined;

        this.initPeer();
        this.startHeartbeat();
    }

    private initPeer() {
        if (this.peer) {
            try {
                this.peer.destroy();
            } catch (e) {
                console.error('Error destroying old peer:', e);
            }
        }

        if (typeof Peer === 'undefined') {
            console.error('PeerJS library (Peer) is not loaded in the browser document.');
            if (this.initialCallback) {
                returnError(this.initialCallback, 'PeerJS library not loaded');
                this.initialCallback = undefined;
            }
            return;
        }

        console.log('Initializing PeerJS client with ID:', this.clientId);
        this.peer = new Peer(this.clientId, {
            debug: 2,
            config: {
                iceServers: this.options.iceServers || [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id: string) => {
            console.log('PeerJS connection established. My Peer ID is:', id);
            this.clientId = id;
            if (this.initialCallback) {
                this.initialCallback({
                    success: true,
                    message: id,
                    messageType: 'clientId'
                });
                this.initialCallback = undefined;
            }
        });

        this.peer.on('error', (err: any) => {
            console.error('PeerJS error encountered:', err);
            this.handlePeerError(err);
        });

        this.peer.on('disconnected', () => {
            console.warn('PeerJS disconnected from signaling server. Attempting to reconnect peer...');
            this.attemptSignalingReconnect();
        });

        // Listen for incoming peer connections (only active on Host)
        this.peer.on('connection', (conn: any) => {
            this.handleIncomingConnection(conn);
        });
    }

    private handlePeerError(err: any) {
        const errType = err.type;
        console.warn(`Handling PeerJS error: ${errType}`);

        if (errType === 'unavailable-id') {
            console.warn('Peer ID is unavailable. Retrying in 2 seconds...');

            // If the collision occurs on a generated ID, regenerate it before retrying
            if (!this.options.customPeerId) {
                this.clientId = 'mp-' + Math.floor(100000 + Math.random() * 900000).toString();
                console.log('Regenerated client ID due to collision:', this.clientId);
            }

            if (this.recreateTimeout) clearTimeout(this.recreateTimeout);
            this.recreateTimeout = setTimeout(() => {
                this.initPeer();
            }, 2000);
        } else if (errType === 'peer-unavailable') {
            console.warn('Target peer is unavailable (host offline). Retrying host connection...');
            this.attemptReconnectToHost();
        } else if (
            errType === 'network' ||
            errType === 'server-error' ||
            errType === 'socket-closed' ||
            errType === 'socket-error'
        ) {
            this.attemptSignalingReconnect();
        }
    }

    private attemptSignalingReconnect() {
        if (this.peer && !this.peer.destroyed) {
            if (this.peer.disconnected) {
                console.log('Attempting to reconnect PeerJS signaling...');
                try {
                    this.peer.reconnect();
                } catch (e) {
                    console.error('Failed to reconnect PeerJS:', e);
                }
            }
        } else {
            console.log('Peer destroyed or missing. Reinitializing PeerJS...');
            this.initPeer();
        }
    }

    private startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
            if (!this.peer || this.peer.destroyed) {
                console.warn('Heartbeat: PeerJS is destroyed or missing. Reinitializing...');
                this.initPeer();
            } else if (this.peer.disconnected) {
                console.warn('Heartbeat: PeerJS disconnected. Reconnecting...');
                this.attemptSignalingReconnect();
            }
        }, 5000);
    }

    public getClientId(): string {
        return this.clientId;
    }

    public updateClientId() {
        this.clientId = this.session.getClientId();
    }

    public setSession(session: ClientSessionInterface) {
        this.session = session;
    }

    /**
     * sendMessage
     * Send packet to host or other clients. Emulates socket.io and server room behaviors.
     */
    public sendMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>) {
        if (!packet.session) {
            packet.session = { action: undefined } as any;
        }

        const packetId = uniqueId('pkt-', true);
        (packet as any).packetId = packetId; // Attach standard request id to link callbacks

        if (cb) {
            this.pendingCallbacks[packetId] = cb;
        }

        // Intercept Room Management actions normally processed by Node server
        if (packet.session.action === SessionMessageType.CreateRoom) {
            // Emulate creating a room on server. In P2P, host's Peer ID is the Room ID.
            this.roomId = this.clientId;
            console.log(`WebRTCTransport: Emulating CreateRoom. Room ID: ${this.roomId}`);
            setTimeout(() => {
                const res = createReturnMessage(true, 'roomId', this.roomId);
                if (cb) cb(res);
            }, 10);
            return;
        }

        if (packet.session.action === SessionMessageType.JoinRoom) {
            // Emulate joining a room. We connect directly to host using their Room ID.
            const targetRoomId = packet.session.roomId;
            this.connectToHost(targetRoomId, cb);
            return;
        }

        if (packet.session.action === SessionMessageType.RejoinRoom) {
            const targetRoomId = packet.session.roomId;
            if (targetRoomId === this.clientId) {
                // Host is rejoining/resuming their own hosted room!
                console.log(`WebRTCTransport: Emulating RejoinRoom for Host. Room ID: ${targetRoomId}`);
                this.roomId = targetRoomId;
                setTimeout(() => {
                    const res = createReturnMessage(true, 'hostId', targetRoomId);
                    if (cb) cb(res);
                }, 10);
                return;
            }

            // Emulate rejoining a room. Same as join, but with existing clientId.
            this.connectToHost(targetRoomId, cb);
            return;
        }

        packet.transport = {};

        if (this.session.isHost()) {
            const toClientId = packet.session.toClientId;
            if (toClientId === this.clientId) {
                // Loopback to self (host to host)
                this.session.onMessage(packet, cb);
            } else if (toClientId && this.connections[toClientId]) {
                // Host to client direct transmission
                this.connections[toClientId].send({
                    packet,
                    packetId,
                    replyExpected: !!cb
                });
            } else {
                console.error(`Host connection to destination client [${toClientId}] not found.`);
                if (cb) returnError(cb, 'Client connection not found');
            }
        } else {
            // Client to Host direct transmission
            if (this.hostConnection) {
                this.hostConnection.send({
                    packet,
                    packetId,
                    replyExpected: !!cb
                });
            } else {
                console.error('Cannot transmit message. Not connected to Host.');
                if (cb) returnError(cb, 'Not connected to Host');
            }
        }
    }

    /**
     * Connect to Host Peer ID
     */
    private connectToHost(hostPeerId: string, cb?: CallbackType<ReturnPacketType>) {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.isReconnecting = false;

        this.roomId = hostPeerId;
        console.log(`Connecting directly to Host Peer ID: ${hostPeerId}`);

        const conn = this.peer.connect(hostPeerId, {
            reliable: true
        });

        this.hostConnection = conn;

        conn.on('open', () => {
            console.log('WebRTC connection to host successfully established!');
            this.hostConnected = true;

            // Send handshake packet so host recognizes client ID
            conn.send({
                handshake: true,
                clientId: this.clientId
            });

            // Handshake return message
            const res = createReturnMessage(true, 'hostId', hostPeerId);
            if (cb) cb(res);
        });

        conn.on('data', (data: any) => {
            this.handleIncomingData(data, conn);
        });

        conn.on('close', () => {
            console.warn('Disconnected from Host.');
            this.hostConnected = false;
            this.session.onReconnect();
            this.attemptReconnectToHost();
        });

        conn.on('error', (err: any) => {
            console.error('WebRTC host connection error:', err);
            this.hostConnected = false;
            if (cb) returnError(cb, err.toString());
            this.attemptReconnectToHost();
        });
    }

    /**
     * Host registers client connection and emulates standard server Room join broadcasts
     */
    private handleIncomingConnection(conn: any) {
        console.log(`Incoming client peer connection pending: ${conn.peer}`);

        conn.on('data', (data: any) => {
            if (data.handshake) {
                const clientPeerId = data.clientId;
                console.log(`Registered direct data connection for client: ${clientPeerId}`);
                
                // Prevent duplicate/ghost stale connections
                if (this.connections[clientPeerId] && this.connections[clientPeerId] !== conn) {
                    console.log(`Closing stale connection for client: ${clientPeerId}`);
                    try {
                        this.connections[clientPeerId].close();
                    } catch (e) {
                        console.error('Error closing stale connection:', e);
                    }
                }
                
                this.connections[clientPeerId] = conn;

                // Broadcast join-room notification locally on Host so GameObject updates list
                const joinBroadcastPacket: PacketType = {
                    session: {
                        action: SessionMessageType.RoomBroadcast
                    },
                    room: {
                        action: RoomMessageType.JoinRoom,
                        clientId: clientPeerId
                    }
                };
                this.session.onMessage(joinBroadcastPacket);
                return;
            }

            this.handleIncomingData(data, conn);
        });

        conn.on('close', () => {
            // Find and cleanup connection
            let disconnectedClientId: string = null;
            for (const id of Object.keys(this.connections)) {
                if (this.connections[id] === conn) {
                    disconnectedClientId = id;
                    break;
                }
            }

            if (disconnectedClientId) {
                console.log(`Client ${disconnectedClientId} connection closed.`);
                delete this.connections[disconnectedClientId];

                // Notify host session to disconnect client and re-route
                const leaveBroadcastPacket: PacketType = {
                    session: {
                        action: SessionMessageType.RoomBroadcast
                    },
                    room: {
                        action: RoomMessageType.LeaveRoom,
                        clientId: disconnectedClientId
                    }
                };
                this.session.onMessage(leaveBroadcastPacket);
            }
        });
    }

    /**
     * Handle incoming data payloads (messages or response replies)
     */
    private handleIncomingData(data: any, conn: any) {
        const { packet, packetId, replyExpected, isReply, replyToPacketId, replyPayload } = data;

        if (isReply) {
            // This is a reply to an earlier outbound message
            const cb = this.pendingCallbacks[replyToPacketId];
            if (cb) {
                cb(replyPayload);
                delete this.pendingCallbacks[replyToPacketId];
            }
            return;
        }

        if (!packet) return;

        // Packet is received, set up dynamic responder if callback is expected
        const cbWrapper = replyExpected ? (replyPayload: ReturnPacketType) => {
            conn.send({
                isReply: true,
                replyToPacketId: packetId,
                replyPayload: replyPayload
            });
        } : undefined;

        // Standard message routing (Host acts as room router)
        const toClientId = packet.session?.toClientId;
        if (this.session.isHost() && toClientId && toClientId !== this.clientId) {
            console.log(`Host routing message from client ${conn.peer} -> target client ${toClientId}`);
            this.sendMessage(packet, cbWrapper);
        } else {
            // Deliver locally
            this.session.onMessage(packet, cbWrapper);
        }
    }

    /**
     * Client WebRTC auto-reconnection loop
     */
    private attemptReconnectToHost() {
        if (this.session.isHost()) return; // Host doesn't need to reconnect to itself
        if (this.kicked) return;
        if (this.isReconnecting) return;

        this.isReconnecting = true;
        console.log(`Attempting to reconnect to Host Room ${this.roomId}...`);

        const tryConnect = () => {
            if (!this.roomId) {
                this.isReconnecting = false;
                return;
            }

            if (!this.peer || this.peer.destroyed) {
                console.warn('Reconnection skipped: peer is destroyed or null. Retrying in 3 seconds...');
                this.isReconnecting = false;
                this.scheduleReconnect();
                return;
            }

            if (this.peer.disconnected) {
                console.warn('Reconnection skipped: peer disconnected from signaling. Reconnecting signaling first...');
                this.attemptSignalingReconnect();
                this.isReconnecting = false;
                this.scheduleReconnect();
                return;
            }

            console.log(`Reconnection attempt to Host Room ${this.roomId}...`);

            if (this.hostConnection) {
                try {
                    this.hostConnection.close();
                } catch (e) {
                    // Ignore
                }
            }

            const conn = this.peer.connect(this.roomId, {
                reliable: true
            });

            this.hostConnection = conn;

            conn.on('open', () => {
                console.log('WebRTC reconnection to host successfully established!');
                this.isReconnecting = false;
                this.hostConnected = true;

                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }

                // Send handshake packet so host recognizes client ID
                conn.send({
                    handshake: true,
                    clientId: this.clientId
                });

                // Trigger the session reconnect logic, which notifies host we are ready
                this.session.onReconnect();
            });

            conn.on('data', (data: any) => {
                this.handleIncomingData(data, conn);
            });

            conn.on('close', () => {
                console.warn('WebRTC reconnection closed.');
                this.hostConnected = false;
                this.scheduleReconnect();
            });

            conn.on('error', (err: any) => {
                console.error('WebRTC reconnection error:', err);
                this.hostConnected = false;
                this.scheduleReconnect();
            });
        };

        tryConnect();
    }

    private scheduleReconnect() {
        if (this.session.isHost()) return;
        if (this.kicked) return;
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
            this.attemptReconnectToHost();
        }, 3000); // Try reconnecting every 3 seconds
    }

    public isConnected(): boolean {
        const isHost = this.session ? this.session.isHost() : false;
        if (isHost) {
            return !!(this.peer && this.peer.open && !this.peer.disconnected);
        } else {
            return this.hostConnected;
        }
    }

    public disconnect(kicked?: boolean): void {
        if (kicked) {
            this.kicked = true;
        }
        if (this.hostConnection) {
            try {
                this.hostConnection.close();
            } catch (e) {
                // Ignore
            }
        }
        if (this.peer) {
            try {
                this.peer.disconnect();
            } catch (e) {
                // Ignore
            }
        }
    }
}

export default WebRTCTransport;
