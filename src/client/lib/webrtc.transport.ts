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

    // Callbacks for local or remote async replies
    private pendingCallbacks: { [packetId: string]: CallbackType<ReturnPacketType> } = {};

    // Reconnection state
    private isReconnecting = false;
    private reconnectTimeout: any = null;

    constructor(
        options: { roomId?: string; customPeerId?: string; iceServers?: any[] },
        cb?: (packet: ReturnPacketType) => any
    ) {
        // Generate a unique client identifier
        this.clientId = options.customPeerId || uniqueId('mp-client-', true).replace(/\./g, '-');
        this.roomId = options.roomId;

        // Initialize PeerJS
        // peerjs.min.js must be loaded from CDN in the host/join template.
        // We use Google's public STUN servers for standard NAT traversal.
        if (typeof Peer === 'undefined') {
            console.error('PeerJS library (Peer) is not loaded in the browser document.');
            if (cb) {
                returnError(cb, 'PeerJS library not loaded');
            }
            return;
        }

        this.peer = new Peer(this.clientId, {
            debug: 2,
            config: {
                iceServers: options.iceServers || [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id: string) => {
            console.log('PeerJS connection established. My Peer ID is:', id);
            this.clientId = id;
            if (cb) {
                cb({
                    success: true,
                    message: id,
                    messageType: 'clientId'
                });
            }
        });

        this.peer.on('error', (err: any) => {
            console.error('PeerJS error encountered:', err);
        });

        this.peer.on('disconnected', () => {
            console.warn('PeerJS disconnected from signaling server. Attempting to reconnect peer...');
            try {
                this.peer.reconnect();
            } catch (e) {
                console.error('Failed to reconnect PeerJS to signaling server:', e);
            }
        });

        // Listen for incoming peer connections (only active on Host)
        this.peer.on('connection', (conn: any) => {
            this.handleIncomingConnection(conn);
        });
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
            this.session.onReconnect();
            this.attemptReconnectToHost();
        });

        conn.on('error', (err: any) => {
            console.error('WebRTC host connection error:', err);
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
        if (this.isReconnecting) return;

        this.isReconnecting = true;
        console.log(`Attempting to reconnect to Host Room ${this.roomId}...`);

        const tryConnect = () => {
            if (!this.roomId) {
                this.isReconnecting = false;
                return;
            }

            console.log(`Reconnection attempt to Host Room ${this.roomId}...`);
            const conn = this.peer.connect(this.roomId, {
                reliable: true
            });

            this.hostConnection = conn;

            conn.on('open', () => {
                console.log('WebRTC reconnection to host successfully established!');
                this.isReconnecting = false;

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
                this.scheduleReconnect();
            });

            conn.on('error', (err: any) => {
                console.error('WebRTC reconnection error:', err);
                this.scheduleReconnect();
            });
        };

        tryConnect();
    }

    private scheduleReconnect() {
        if (this.session.isHost()) return;
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
            this.attemptReconnectToHost();
        }, 3000); // Try reconnecting every 3 seconds
    }
}

export default WebRTCTransport;
