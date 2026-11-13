/**
 * webrtc.transport.ts (client).
 *
 * Implements WebRTC transport using PeerJS library.
 * Emulates the room management server-side logic in a static, host-centric star topology.
 *
 * Resilience model
 * ----------------
 * WebRTC data channels frequently die *silently*: a laptop sleeps, Wi-Fi switches,
 * or the remote tab closes abruptly and PeerJS never fires 'close'/'error'. To detect
 * these we run an application-level heartbeat (ping/pong) over the data channel itself,
 * independent of the PeerJS signaling socket:
 *
 *   - Clients ping the host every PING_INTERVAL_MS. The host replies with a pong.
 *   - Each side stamps a "last seen" time on every inbound message (heartbeat or real
 *     traffic). If nothing is heard within LIVENESS_TIMEOUT_MS the peer is considered
 *     dead regardless of what PeerJS thinks.
 *   - On the client, a dead host triggers the reconnection loop.
 *   - On the host, a dead client is torn down and a LeaveRoom broadcast is emitted so the
 *     game state (and the connectivity dot) reflect reality.
 *
 * isConnected() is derived from this liveness state, so the shell status dot is accurate.
 *
 * Network changes (e.g. 5G -> Wi-Fi)
 * ----------------------------------
 * A network switch kills both the data channels and the signaling WebSocket, usually
 * without the old socket closing cleanly on the server. Two things keep us recoverable:
 *
 *   - Stable peer ID: the PeerServer only lets a peer re-register an ID it still holds if
 *     it presents the same token. PeerJS generates a fresh random token per Peer, so we
 *     pin one per peer ID (persisted per tab in sessionStorage) and always reconnect with it. Once
 *     an ID has been opened we never regenerate it (that would silently change the room
 *     ID for a host, or the player identity for a client); 'unavailable-id' is retried
 *     with backoff instead.
 *   - Fast detection: online / connection-change / tab-visible events trigger an immediate
 *     heartbeat probe. If the probe gets no answer, the signaling socket is refreshed and
 *     the data channel(s) rebuilt, instead of waiting for the full liveness timeout.
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
    RoomMessageType,
    ConnectionStatus,
    NetworkDiagnostics,
    PeerLinkDiagnostics,
    TurnProbeResult
} from '../../common/interfaces';

declare const Peer: any;

interface TurnServerEntry {
    url: string;
    username?: string;
    credential?: string;
}

function describeIceError(code: number, text: string): string {
    if (code === 401) return 'Credentials rejected (401)';
    if (code === 701) return 'Could not reach the server';
    if (code >= 300 && code < 700) return `Server error ${code}${text ? ': ' + text : ''}`;
    return text || ('Error ' + code);
}

export class WebRTCTransport implements ClientTransportInterface {
    // How often clients ping the host (and how often the liveness sweep runs).
    private static readonly PING_INTERVAL_MS = 3000;
    // No traffic within this window => the peer is considered dead (~3 missed pings).
    private static readonly LIVENESS_TIMEOUT_MS = 10000;
    // A brand new connection that does not open within this window is treated as failed.
    private static readonly CONNECT_TIMEOUT_MS = 8000;
    // Reconnection backoff bounds.
    private static readonly RECONNECT_BASE_MS = 2000;
    private static readonly RECONNECT_MAX_MS = 15000;
    // How many times we retry the *initial* join (room not found / host offline) before
    // giving up and surfacing an error. Established sessions reconnect without limit.
    private static readonly MAX_JOIN_ATTEMPTS = 4;
    // How many times we retry acquiring our peer ID when it is reported unavailable
    // (e.g. a stale previous session still holding the ID) before surfacing an error.
    private static readonly MAX_ID_ATTEMPTS = 3;
    // How long a rejoin/resume (custom ID that has not opened yet in this page) keeps
    // trying to reclaim an ID reported as taken. Must exceed the PeerServer's dead-socket
    // timeout (60s by default) so a stale registration from a dropped network can expire.
    private static readonly ID_RECLAIM_WINDOW_MS = 90000;
    // Signaling (PeerServer WebSocket) reconnection backoff bounds.
    private static readonly SIGNALING_RETRY_BASE_MS = 500;
    private static readonly SIGNALING_RETRY_MAX_MS = 10000;
    // After a network-change event, how long to wait for heartbeat traffic before treating
    // the link as dead.
    private static readonly PROBE_TIMEOUT_MS = 4000;
    // Debounce for bursts of network-change events.
    private static readonly NETWORK_CHANGE_DEBOUNCE_MS = 500;
    private static readonly TOKEN_STORAGE_PREFIX = 'mp-peer-token:';
    // TURN reachability probe: per-server timeout, and how long a result stays fresh.
    private static readonly TURN_PROBE_TIMEOUT_MS = 8000;
    private static readonly TURN_PROBE_TTL_MS = 5 * 60 * 1000;

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

    // Client liveness: timestamp of the last message received from the host.
    private lastHostSeen = 0;

    // Callbacks for local or remote async replies
    private pendingCallbacks: { [packetId: string]: CallbackType<ReturnPacketType> } = {};

    // Reconnection state
    private isReconnecting = false;
    // True while a connection attempt (initial or reconnect) is in flight, i.e. a
    // connection has been created but has not yet opened. Prevents the liveness monitor
    // (or any other caller) from clobbering an in-progress handshake.
    private connecting = false;
    private reconnectTimeout: any = null;
    private reconnectAttempts = 0;
    private connectTimeout: any = null;
    private options: { roomId?: string; customPeerId?: string; iceServers?: any[] };
    private initialCallback?: (packet: ReturnPacketType) => any;
    private monitorInterval: any = null;
    private recreateTimeout: any = null;

    // Initial-join tracking. pendingConnectCb is the join/rejoin callback awaiting the
    // first successful connection; it is resolved on success or on give-up (error).
    private pendingConnectCb: CallbackType<ReturnPacketType> = null;
    private joinAttempts = 0;
    private idAttempts = 0;
    private hasEverConnected = false;
    // Set once we have exhausted retries and reported a terminal join error, to stop
    // the background retry loops from spinning.
    private joinFailed = false;

    // Signaling resilience state (see "Network changes" above).
    private peerToken = '';
    private peerHasOpened = false;
    private idTakenSince = 0;
    private signalingFailures = 0;
    private signalingRetryTimeout: any = null;

    // Network-change handling.
    private networkChangeTimeout: any = null;
    private probeTimeout: any = null;
    private networkListenersAttached = false;

    // Client connection progress, surfaced to the join page and the client network view.
    private status: ConnectionStatus = { phase: 'signaling', attempt: 0 };
    private statusListeners: Array<(status: ConnectionStatus) => void> = [];
    private lastFailureReason: string | undefined = undefined;

    // TURN reachability probe state.
    private turnProbe: TurnProbeResult[] = [];
    private turnProbePromise: Promise<TurnProbeResult[]> | null = null;
    private turnProbeAt = 0;

    private readonly onNetworkChange = (event?: Event) => {
        if (event && event.type === 'visibilitychange' &&
            typeof document !== 'undefined' && document.visibilityState !== 'visible') {
            return;
        }
        const forceSignaling = !!(event && event.type === 'online');
        if (this.networkChangeTimeout) clearTimeout(this.networkChangeTimeout);
        this.networkChangeTimeout = setTimeout(() => {
            this.networkChangeTimeout = null;
            this.handleNetworkChange(forceSignaling);
        }, WebRTCTransport.NETWORK_CHANGE_DEBOUNCE_MS);
    };

    constructor(
        options: { roomId?: string; customPeerId?: string; iceServers?: any[] },
        cb?: (packet: ReturnPacketType) => any
    ) {
        this.options = options;
        this.initialCallback = cb;
        // Generate a unique client identifier (short P2P ID format: mp-XXXXXX)
        this.clientId = options.customPeerId || ('mp-' + Math.floor(100000 + Math.random() * 900000).toString());
        this.roomId = options.roomId ? (options.roomId.startsWith('mp-') ? options.roomId : 'mp-' + options.roomId) : undefined;

        this.peerToken = this.loadPeerToken(this.clientId);

        this.initPeer();
        this.startMonitor();
        this.attachNetworkListeners();
    }

    /**
     * The PeerServer token for a peer ID. Reusing it lets us re-register the same ID while
     * the server still holds a stale registration (after a network switch or page reload).
     */
    private loadPeerToken(peerId: string): string {
        const key = WebRTCTransport.TOKEN_STORAGE_PREFIX + peerId;
        try {
            const stored = window.sessionStorage.getItem(key);
            if (stored) return stored;
        } catch (e) {
            // Storage unavailable (private mode etc.); fall back to an in-memory token.
        }
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        try {
            window.sessionStorage.setItem(key, token);
        } catch (e) {
            // Ignore
        }
        return token;
    }

    private initPeer() {
        if (this.recreateTimeout) {
            clearTimeout(this.recreateTimeout);
            this.recreateTimeout = null;
        }
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
            token: this.peerToken,
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
            // We successfully acquired our peer ID: from now on it is our identity (and,
            // for a host, the room ID), so it must never be regenerated.
            this.idAttempts = 0;
            this.peerHasOpened = true;
            this.idTakenSince = 0;
            this.signalingFailures = 0;
            this.clearSignalingRetry();
            if (this.initialCallback) {
                this.initialCallback({
                    success: true,
                    message: id,
                    messageType: 'clientId'
                });
                this.initialCallback = undefined;
            }

            // Signaling is back. If we are a client with a known room but no live host
            // connection, kick off reconnection immediately rather than waiting for the
            // next monitor tick.
            if (this.session && !this.session.isHost() && this.roomId && !this.isHostLinkAlive()) {
                this.attemptReconnectToHost();
            }
        });

        this.peer.on('error', (err: any) => {
            console.error('PeerJS error encountered:', err);
            this.handlePeerError(err);
        });

        this.peer.on('disconnected', () => {
            console.warn('PeerJS disconnected from signaling server. Scheduling signaling reconnect...');
            // Scheduled (not immediate): PeerJS also emits 'disconnected' when the server
            // rejects our ID, and reconnecting synchronously would hammer the server.
            this.scheduleSignalingReconnect();
        });

        // Listen for incoming peer connections (only active on Host)
        this.peer.on('connection', (conn: any) => {
            this.handleIncomingConnection(conn);
        });
    }

    private handlePeerError(err: any) {
        const errType = err.type;
        console.warn(`Handling PeerJS error: ${errType}`);

        if (errType === 'unavailable-id' && (this.peerHasOpened || this.options.customPeerId)) {
            // This ID is our identity (already opened here, or a rejoin/resume). Most likely
            // the server still holds a stale registration from before a network switch or
            // reload. Keep the ID and retry with backoff until that registration expires.
            if (!this.idTakenSince) this.idTakenSince = Date.now();
            const elapsed = Date.now() - this.idTakenSince;
            if (!this.peerHasOpened && elapsed > WebRTCTransport.ID_RECLAIM_WINDOW_MS) {
                console.error('Peer ID remained unavailable for the whole reclaim window. Giving up.');
                this.failInit('This player is already connected (client ID "' + this.clientId +
                    '" is in use). Close the other tab or device using it and try again, or join as a new player.');
                return;
            }
            console.warn(`Peer ID ${this.clientId} is still registered on the server (${Math.round(elapsed / 1000)}s). Retrying with the same ID...`);
            if (!this.peerHasOpened) {
                this.setStatus({
                    phase: 'signaling',
                    lastError: `Your player ID is still registered from a previous connection; waiting for it to free up (${Math.round(elapsed / 1000)}s)…`
                });
            }
            this.signalingFailures++;
            this.scheduleSignalingReconnect();
        } else if (errType === 'unavailable-id') {
            this.idAttempts++;

            if (this.idAttempts > WebRTCTransport.MAX_ID_ATTEMPTS) {
                console.error('Peer ID remained unavailable after retries. Giving up.');
                if (this.options.customPeerId) {
                    this.failInit('This player is already connected (client ID "' + this.clientId +
                        '" is in use). Close the other tab or device using it and try again, or join as a new player.');
                } else {
                    this.failInit('Could not obtain an available client ID. Please refresh the page and try again.');
                }
                return;
            }

            console.warn(`Peer ID is unavailable (attempt ${this.idAttempts}/${WebRTCTransport.MAX_ID_ATTEMPTS}). Retrying in 2 seconds...`);

            // A freshly generated ID that has never opened collided with someone else's:
            // pick a new one before retrying.
            this.clientId = 'mp-' + Math.floor(100000 + Math.random() * 900000).toString();
            this.peerToken = this.loadPeerToken(this.clientId);
            console.log('Regenerated client ID due to collision:', this.clientId);

            if (this.recreateTimeout) clearTimeout(this.recreateTimeout);
            this.recreateTimeout = setTimeout(() => {
                this.initPeer();
            }, 2000);
        } else if (errType === 'peer-unavailable') {
            console.warn('Target peer is unavailable (host offline). Retrying host connection...');
            this.lastFailureReason = 'The host could not be found. Check the room code, or the host may be offline.';
            this.markHostDisconnected();
            // This connect attempt is definitively done; don't wait for the stall timeout
            // so the bounded retry loop can proceed at the backoff cadence. (peer-unavailable
            // is emitted on the peer, not the connection, so the conn's own close/error
            // handlers that would normally reset these flags never fire.)
            this.connecting = false;
            this.isReconnecting = false;
            this.clearConnectTimeout();
            this.scheduleReconnect();
        } else if (
            errType === 'network' ||
            errType === 'server-error' ||
            errType === 'socket-closed' ||
            errType === 'socket-error'
        ) {
            this.lastFailureReason = 'Lost contact with the signaling server.';
            this.signalingFailures++;
            this.scheduleSignalingReconnect();
        }
    }

    private clearSignalingRetry() {
        if (this.signalingRetryTimeout) {
            clearTimeout(this.signalingRetryTimeout);
            this.signalingRetryTimeout = null;
        }
    }

    /** Reconnect signaling after a backoff delay; a no-op if a retry is already pending. */
    private scheduleSignalingReconnect() {
        if (this.joinFailed || this.kicked) return;
        if (this.signalingRetryTimeout || this.recreateTimeout) return;
        const delay = Math.min(
            WebRTCTransport.SIGNALING_RETRY_BASE_MS * Math.pow(2, this.signalingFailures),
            WebRTCTransport.SIGNALING_RETRY_MAX_MS
        ) + Math.floor(Math.random() * 250);
        this.signalingRetryTimeout = setTimeout(() => {
            this.signalingRetryTimeout = null;
            this.attemptSignalingReconnect();
        }, delay);
    }

    /**
     * Drop and re-establish the signaling socket. Used when a network change has left the
     * WebSocket half-dead (still "connected" from the browser's point of view). Existing
     * data channels are untouched, and the stable token lets the server re-attach our ID.
     */
    private refreshSignaling() {
        if (!this.peer || this.peer.destroyed) {
            this.attemptSignalingReconnect();
            return;
        }
        console.warn('Refreshing PeerJS signaling connection after network change...');
        if (!this.peer.disconnected) {
            try {
                this.peer.disconnect(); // emits 'disconnected', which schedules a retry...
            } catch (e) {
                // Ignore
            }
        }
        // ...but we want it now, not after the backoff.
        this.clearSignalingRetry();
        this.signalingFailures = 0;
        this.attemptSignalingReconnect();
    }

    private attemptSignalingReconnect() {
        if (this.joinFailed || this.kicked) return;
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

    /**
     * Single periodic monitor driving both signaling health and data-channel liveness.
     * Runs for host and client roles; behavior is role-dependent.
     */
    private startMonitor() {
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        this.monitorInterval = setInterval(() => {
            this.monitorTick();
        }, WebRTCTransport.PING_INTERVAL_MS);
    }

    private monitorTick() {
        // Keep the signaling socket healthy for both roles. Retries go through the backoff
        // scheduler so the monitor never short-circuits an ID-reclaim wait.
        if (!this.joinFailed && !this.kicked) {
            if (!this.peer || this.peer.destroyed || this.peer.disconnected) {
                this.scheduleSignalingReconnect();
            }
        }
        if (!this.peer || this.peer.destroyed) return;

        const isHost = this.session ? this.session.isHost() : false;

        if (isHost) {
            this.sweepClientLiveness();
        } else {
            this.pingHostAndCheckLiveness();
        }
    }

    private attachNetworkListeners() {
        if (this.networkListenersAttached || typeof window === 'undefined') return;
        this.networkListenersAttached = true;
        window.addEventListener('online', this.onNetworkChange);
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.onNetworkChange);
        }
        const connection = (navigator as any).connection;
        if (connection && typeof connection.addEventListener === 'function') {
            connection.addEventListener('change', this.onNetworkChange);
        }
    }

    private detachNetworkListeners() {
        if (!this.networkListenersAttached) return;
        this.networkListenersAttached = false;
        window.removeEventListener('online', this.onNetworkChange);
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.onNetworkChange);
        }
        const connection = (navigator as any).connection;
        if (connection && typeof connection.removeEventListener === 'function') {
            connection.removeEventListener('change', this.onNetworkChange);
        }
        if (this.networkChangeTimeout) {
            clearTimeout(this.networkChangeTimeout);
            this.networkChangeTimeout = null;
        }
        if (this.probeTimeout) {
            clearTimeout(this.probeTimeout);
            this.probeTimeout = null;
        }
    }

    /**
     * The network may have changed (or the tab woke up). Probe the data channel(s) with an
     * immediate heartbeat; only if the probe goes unanswered do we tear things down. This
     * keeps spurious events (e.g. a cellular quality change) from disrupting a healthy link.
     */
    private handleNetworkChange(forceSignaling: boolean) {
        if (this.joinFailed || this.kicked) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return; // wait for 'online'

        console.log('Network change detected. Probing connection health...');

        if (!this.peer || this.peer.destroyed || this.peer.disconnected) {
            this.clearSignalingRetry();
            this.signalingFailures = 0;
            this.attemptSignalingReconnect();
        }

        const isHost = this.session ? this.session.isHost() : false;
        const probeStartedAt = Date.now();

        if (isHost) {
            const clientIds = Object.keys(this.connections);
            if (clientIds.length === 0) {
                // Nobody to probe with; only a definite 'online' transition is worth a
                // signaling refresh so joiners can still reach us.
                if (forceSignaling) this.refreshSignaling();
                return;
            }
            for (const clientId of clientIds) {
                const conn = this.connections[clientId];
                try {
                    if (conn && conn.open) conn.send({ __hb: 'ping', t: probeStartedAt });
                } catch (e) {
                    // Treated as dead below.
                }
            }
        } else {
            if (!this.roomId) return;
            if (!this.isHostLinkAlive()) {
                // Already known dead: refresh signaling and reconnect right away rather
                // than waiting out the current backoff.
                this.refreshSignaling();
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
                this.reconnectAttempts = 0;
                this.attemptReconnectToHost();
                return;
            }
            try {
                this.hostConnection.send({ __hb: 'ping', t: probeStartedAt });
            } catch (e) {
                // Treated as dead below.
            }
        }

        if (this.probeTimeout) clearTimeout(this.probeTimeout);
        this.probeTimeout = setTimeout(() => {
            this.probeTimeout = null;
            this.checkProbe(probeStartedAt);
        }, WebRTCTransport.PROBE_TIMEOUT_MS);
    }

    private checkProbe(probeStartedAt: number) {
        if (this.joinFailed || this.kicked) return;
        const isHost = this.session ? this.session.isHost() : false;

        if (isHost) {
            const clientIds = Object.keys(this.connections);
            let dead = 0;
            for (const clientId of clientIds) {
                const conn = this.connections[clientId];
                const lastSeen = conn && conn.__mpLastSeen ? conn.__mpLastSeen : 0;
                if (!conn || conn.open === false || lastSeen < probeStartedAt) {
                    console.warn(`Network probe: client ${clientId} did not answer. Tearing down.`);
                    this.teardownClientConnection(clientId, conn);
                    dead++;
                }
            }
            // If every client went silent at once, the host's own network most likely
            // changed: its signaling socket is probably half-dead too, and clients need it
            // to reach us again.
            if (clientIds.length > 0 && dead === clientIds.length) {
                this.refreshSignaling();
            }
        } else {
            if (this.isHostLinkAlive() && this.lastHostSeen >= probeStartedAt) {
                console.log('Network probe: host link is healthy.');
                return;
            }
            console.warn('Network probe: host did not answer. Refreshing signaling and reconnecting...');
            this.lastFailureReason = 'Your network changed and the host stopped answering.';
            this.markHostDisconnected();
            this.refreshSignaling();
            // Abandon any in-flight attempt; it was probably started on the old network.
            this.clearConnectTimeout();
            this.connecting = false;
            this.isReconnecting = false;
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
            this.reconnectAttempts = 0;
            this.attemptReconnectToHost();
        }
    }

    /**
     * Host: drop clients we have not heard from within the liveness window.
     */
    private sweepClientLiveness() {
        const now = Date.now();
        for (const clientId of Object.keys(this.connections)) {
            const conn = this.connections[clientId];
            const lastSeen = conn && conn.__mpLastSeen ? conn.__mpLastSeen : 0;
            const channelDead = conn && conn.open === false;
            if (channelDead || now - lastSeen > WebRTCTransport.LIVENESS_TIMEOUT_MS) {
                console.warn(`Host liveness: client ${clientId} timed out. Tearing down.`);
                this.teardownClientConnection(clientId, conn);
            }
        }
    }

    private teardownClientConnection(clientId: string, conn: any) {
        if (this.connections[clientId] === conn) {
            delete this.connections[clientId];
        }
        try {
            if (conn) conn.close();
        } catch (e) {
            // Ignore
        }

        // Notify host session so the client is marked disconnected (updates __isConnected
        // and therefore the connectivity dot).
        const leaveBroadcastPacket: PacketType = {
            session: {
                action: SessionMessageType.RoomBroadcast
            },
            room: {
                action: RoomMessageType.LeaveRoom,
                clientId: clientId
            }
        };
        this.session.onMessage(leaveBroadcastPacket);
    }

    /**
     * Client: send a heartbeat to the host and detect a silently-dead host link.
     */
    private pingHostAndCheckLiveness() {
        if (this.kicked) return;
        if (!this.roomId) return;

        const conn = this.hostConnection;
        if (conn && conn.open) {
            try {
                conn.send({ __hb: 'ping', t: Date.now() });
            } catch (e) {
                // Send failure implies a dead channel.
                console.warn('Heartbeat send to host failed. Treating link as dead.');
            }
        }

        // If we believe we are connected but have heard nothing recently, the link is dead.
        if (this.hostConnected && this.lastHostSeen > 0 &&
            Date.now() - this.lastHostSeen > WebRTCTransport.LIVENESS_TIMEOUT_MS) {
            console.warn('Client liveness: no traffic from host within timeout. Reconnecting...');
            this.lastFailureReason = 'Stopped hearing from the host.';
            this.markHostDisconnected();
            this.attemptReconnectToHost();
            return;
        }

        // Self-heal: if we are not connected and no attempt is already in flight, make
        // sure a reconnection is scheduled. This covers cases where no close/error ever
        // fired. Crucially this must NOT fire while a connection is still being
        // established (this.connecting), otherwise it would tear down the in-progress
        // initial handshake used by the join/rejoin flow.
        if (!this.isHostLinkAlive() && !this.connecting && !this.isReconnecting && !this.reconnectTimeout) {
            this.attemptReconnectToHost();
        }
    }

    /** True if the client's data channel to the host is genuinely usable. */
    private isHostLinkAlive(): boolean {
        return !!(this.hostConnected && this.hostConnection && this.hostConnection.open);
    }

    private markHostDisconnected() {
        this.hostConnected = false;
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
            } else if (toClientId && this.connections[toClientId] && this.connections[toClientId].open) {
                // Host to client direct transmission
                this.connections[toClientId].send({
                    packet,
                    packetId,
                    replyExpected: !!cb
                });
            } else {
                console.error(`Host connection to destination client [${toClientId}] not found or not open.`);
                if (cb) returnError(cb, 'Client connection not found');
            }
        } else {
            // Client to Host direct transmission
            if (this.hostConnection && this.hostConnection.open) {
                this.hostConnection.send({
                    packet,
                    packetId,
                    replyExpected: !!cb
                });
            } else {
                console.error('Cannot transmit message. Not connected to Host.');
                if (cb) returnError(cb, 'Not connected to Host');
                // Ensure we are trying to get back online.
                this.attemptReconnectToHost();
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

        // Fresh join/rejoin: reset the give-up state and remember the callback so the
        // bounded-retry logic can resolve it on success or on final failure.
        this.pendingConnectCb = cb || null;
        this.joinAttempts = 0;
        this.reconnectAttempts = 0;
        this.joinFailed = false;
        this.lastFailureReason = undefined;

        this.connecting = true;
        this.setStatus({
            phase: 'connecting',
            attempt: 1,
            maxAttempts: WebRTCTransport.MAX_JOIN_ATTEMPTS + 1,
            nextRetryAt: undefined,
            lastError: undefined,
            reconnecting: false
        });
        const conn = this.peer.connect(hostPeerId, {
            reliable: true
        });

        this.hostConnection = conn;

        // Guard against a connection that never opens (silent stall).
        this.armConnectTimeout(conn);

        conn.on('open', () => {
            this.clearConnectTimeout();
            this.connecting = false;
            console.log('WebRTC connection to host successfully established!');
            this.hostConnected = true;
            this.hasEverConnected = true;
            this.joinAttempts = 0;
            this.lastHostSeen = Date.now();
            this.reconnectAttempts = 0;
            this.lastFailureReason = undefined;
            this.setStatus({ phase: 'connected', nextRetryAt: undefined, lastError: undefined });

            // Send handshake packet so host recognizes client ID
            conn.send({
                handshake: true,
                clientId: this.clientId
            });

            // Handshake return message resolves the pending join/rejoin callback.
            this.pendingConnectCb = null;
            const res = createReturnMessage(true, 'hostId', hostPeerId);
            if (cb) cb(res);
        });

        conn.on('data', (data: any) => {
            this.handleIncomingData(data, conn);
        });

        conn.on('close', () => {
            if (this.hostConnection !== conn) return; // A superseded connection; ignore.
            console.warn('Disconnected from Host.');
            this.lastFailureReason = 'The connection to the host was closed.';
            this.connecting = false;
            this.markHostDisconnected();
            // Do not resolve the join callback here; let the bounded retry loop decide
            // whether this is a recoverable blip or a terminal failure.
            this.attemptReconnectToHost();
        });

        conn.on('error', (err: any) => {
            console.error('WebRTC host connection error:', err);
            if (this.hostConnection !== conn) return;
            this.lastFailureReason = 'The connection to the host failed.';
            this.connecting = false;
            this.markHostDisconnected();
            this.attemptReconnectToHost();
        });
    }

    /**
     * Host registers client connection and emulates standard server Room join broadcasts
     */
    private handleIncomingConnection(conn: any) {
        console.log(`Incoming client peer connection pending: ${conn.peer}`);
        conn.__mpLastSeen = Date.now();

        conn.on('data', (data: any) => {
            conn.__mpLastSeen = Date.now();

            if (data && data.handshake) {
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

                conn.__mpClientId = clientPeerId;
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
            let disconnectedClientId: string = conn.__mpClientId || null;
            if (!disconnectedClientId) {
                for (const id of Object.keys(this.connections)) {
                    if (this.connections[id] === conn) {
                        disconnectedClientId = id;
                        break;
                    }
                }
            }

            if (disconnectedClientId && this.connections[disconnectedClientId] === conn) {
                console.log(`Client ${disconnectedClientId} connection closed.`);
                this.teardownClientConnection(disconnectedClientId, conn);
            }
        });

        conn.on('error', (err: any) => {
            console.error(`Host connection error for ${conn.peer}:`, err);
        });
    }

    /**
     * Handle incoming data payloads (messages or response replies)
     */
    private handleIncomingData(data: any, conn: any) {
        if (!data) return;

        // Stamp liveness for whichever role we are.
        if (this.session && this.session.isHost()) {
            conn.__mpLastSeen = Date.now();
        } else if (conn === this.hostConnection) {
            this.lastHostSeen = Date.now();
        }

        // Application-level heartbeat handling.
        if (data.__hb) {
            if (data.__hb === 'ping') {
                // Clients ping the host on every monitor tick; the host only pings clients
                // when probing after a network change. Either side answers.
                try {
                    if (conn && conn.open) conn.send({ __hb: 'pong', t: data.t });
                } catch (e) {
                    // Ignore
                }
            }
            // 'pong' (or 'ping') already refreshed liveness above; nothing more to do.
            return;
        }

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

    private armConnectTimeout(conn: any) {
        this.clearConnectTimeout();
        this.connectTimeout = setTimeout(() => {
            if (this.hostConnection === conn && !this.isHostLinkAlive()) {
                console.warn('Connection to host stalled (never opened). Retrying...');
                this.lastFailureReason = 'Could not open a connection to the host in time (network or firewall blocking it).';
                this.markHostDisconnected();
                try {
                    conn.close();
                } catch (e) {
                    // Ignore
                }
                this.connecting = false;
                this.isReconnecting = false;
                this.scheduleReconnect();
            }
        }, WebRTCTransport.CONNECT_TIMEOUT_MS);
    }

    private clearConnectTimeout() {
        if (this.connectTimeout) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
        }
    }

    /**
     * Client WebRTC auto-reconnection loop
     */
    private attemptReconnectToHost() {
        if (this.session && this.session.isHost()) return; // Host doesn't reconnect to itself
        if (this.kicked) return;
        if (this.joinFailed) return; // Already gave up and reported a terminal error
        if (this.connecting) return; // A connection attempt (initial or reconnect) is already in flight
        if (this.isReconnecting) return;
        if (!this.roomId) return;

        // While the initial join is still pending (we have never connected), cap the
        // number of attempts so a non-existent room / offline host surfaces an error
        // instead of retrying forever. Once connected at least once, we reconnect without
        // limit so live games survive transient network drops.
        if (this.pendingConnectCb && !this.hasEverConnected) {
            if (this.joinAttempts >= WebRTCTransport.MAX_JOIN_ATTEMPTS) {
                this.failJoin('Could not reach room "' + this.displayRoomId() +
                    '". It may not exist, or the host may be offline. Check the Room ID and try again.');
                return;
            }
            this.joinAttempts++;
        }

        if (!this.peer || this.peer.destroyed) {
            console.warn('Reconnect: peer is destroyed or null. Reinitializing and retrying...');
            this.scheduleSignalingReconnect();
            this.scheduleReconnect();
            return;
        }

        if (this.peer.disconnected || !this.peer.open) {
            // PeerJS silently drops signaling messages (our offer) while its socket is
            // (re)opening, so connecting now would just stall. The peer 'open' handler
            // retries as soon as signaling is up; the scheduled retry is a fallback.
            console.warn('Reconnect: signaling not ready yet. Waiting for it before connecting...');
            if (!this.lastFailureReason) this.lastFailureReason = 'Waiting for the signaling server.';
            if (this.peer.disconnected) this.scheduleSignalingReconnect();
            this.scheduleReconnect();
            return;
        }

        this.isReconnecting = true;
        this.connecting = true;
        this.reconnectAttempts++;
        console.log(`Reconnection attempt #${this.reconnectAttempts} to Host Room ${this.roomId}...`);
        const initialJoin = !!(this.pendingConnectCb && !this.hasEverConnected);
        this.setStatus({
            phase: 'connecting',
            attempt: initialJoin ? this.joinAttempts + 1 : this.reconnectAttempts,
            maxAttempts: initialJoin ? WebRTCTransport.MAX_JOIN_ATTEMPTS + 1 : undefined,
            nextRetryAt: undefined,
            lastError: this.lastFailureReason,
            reconnecting: this.hasEverConnected
        });

        if (this.hostConnection) {
            // Detach first: closing fires the old connection's 'close' handler, which must
            // not reset the state of the attempt we are about to start.
            const oldConn = this.hostConnection;
            this.hostConnection = null;
            try {
                oldConn.close();
            } catch (e) {
                // Ignore
            }
        }

        const conn = this.peer.connect(this.roomId, {
            reliable: true
        });

        this.hostConnection = conn;
        this.armConnectTimeout(conn);

        conn.on('open', () => {
            this.clearConnectTimeout();
            this.connecting = false;
            console.log('WebRTC reconnection to host successfully established!');
            this.isReconnecting = false;
            this.hostConnected = true;
            this.hasEverConnected = true;
            this.joinAttempts = 0;
            this.lastHostSeen = Date.now();
            this.reconnectAttempts = 0;
            this.lastFailureReason = undefined;
            this.setStatus({ phase: 'connected', nextRetryAt: undefined, lastError: undefined });

            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }

            // Send handshake packet so host recognizes client ID
            conn.send({
                handshake: true,
                clientId: this.clientId
            });

            // If this connection resolved a still-pending initial join (the host came
            // online during our retries), complete that callback with success.
            if (this.pendingConnectCb) {
                const joinCb = this.pendingConnectCb;
                this.pendingConnectCb = null;
                joinCb(createReturnMessage(true, 'hostId', this.roomId));
            }

            // Trigger the session reconnect logic, which notifies host we are ready
            this.session.onReconnect();
        });

        conn.on('data', (data: any) => {
            this.handleIncomingData(data, conn);
        });

        conn.on('close', () => {
            if (this.hostConnection !== conn) return; // A superseded connection; ignore.
            console.warn('WebRTC reconnection closed.');
            this.lastFailureReason = 'The connection to the host was closed.';
            this.connecting = false;
            this.markHostDisconnected();
            this.isReconnecting = false;
            this.scheduleReconnect();
        });

        conn.on('error', (err: any) => {
            console.error('WebRTC reconnection error:', err);
            if (this.hostConnection !== conn) return;
            this.lastFailureReason = 'The connection to the host failed.';
            this.connecting = false;
            this.markHostDisconnected();
            this.isReconnecting = false;
            this.scheduleReconnect();
        });
    }

    /** Room ID without the internal 'mp-' prefix, for user-facing messages. */
    private displayRoomId(): string {
        const id = this.roomId || '';
        return id.indexOf('mp-') === 0 ? id.substring(3) : id;
    }

    /**
     * Terminal failure of the initial join: stop all retry loops and report the error
     * through the pending join/rejoin callback so the page can show it.
     */
    private failJoin(message: string) {
        this.joinFailed = true;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.recreateTimeout) {
            clearTimeout(this.recreateTimeout);
            this.recreateTimeout = null;
        }
        this.clearConnectTimeout();
        this.connecting = false;
        this.isReconnecting = false;
        this.setStatus({ phase: 'failed', nextRetryAt: undefined, lastError: this.lastFailureReason || message });

        const cb = this.pendingConnectCb;
        this.pendingConnectCb = null;
        if (cb) {
            returnError(cb, message);
        }
    }

    /**
     * Terminal failure while acquiring our own peer ID (e.g. the ID is already in use).
     * Reported through the transport-init callback if the peer never opened, otherwise
     * through the join callback.
     */
    private failInit(message: string) {
        this.joinFailed = true;
        if (this.recreateTimeout) {
            clearTimeout(this.recreateTimeout);
            this.recreateTimeout = null;
        }

        const initCb = this.initialCallback;
        this.initialCallback = undefined;
        if (initCb) {
            this.setStatus({ phase: 'failed', nextRetryAt: undefined, lastError: message });
            returnError(initCb, message);
        } else {
            this.failJoin(message);
        }
    }

    private scheduleReconnect() {
        if (this.session && this.session.isHost()) return;
        if (this.kicked) return;
        if (this.joinFailed) return; // Already gave up and reported a terminal error
        if (!this.roomId) return;
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        // Exponential backoff with jitter, capped, so a persistently-offline host does
        // not cause a tight reconnect storm.
        const backoff = Math.min(
            WebRTCTransport.RECONNECT_BASE_MS * Math.pow(2, Math.max(0, this.reconnectAttempts - 1)),
            WebRTCTransport.RECONNECT_MAX_MS
        );
        const jitter = Math.floor(Math.random() * 500);
        const delay = backoff + jitter;

        console.log(`Scheduling reconnect in ${delay}ms.`);
        this.setStatus({
            phase: 'waiting-retry',
            nextRetryAt: Date.now() + delay,
            lastError: this.lastFailureReason
        });
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.attemptReconnectToHost();
        }, delay);
    }

    /**
     * Subscribe to client connection progress (attempts, retries, failures). The listener
     * is called immediately with the current status. Returns an unsubscribe function.
     */
    public onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
        this.statusListeners.push(listener);
        try {
            listener({ ...this.status });
        } catch (e) {
            console.error('Connection status listener failed:', e);
        }
        return () => {
            this.statusListeners = this.statusListeners.filter((l) => l !== listener);
        };
    }

    public getStatus(): ConnectionStatus {
        return { ...this.status };
    }

    private setStatus(patch: Partial<ConnectionStatus>) {
        this.status = { ...this.status, ...patch };
        const snapshot = { ...this.status };
        this.statusListeners.forEach((listener) => {
            try {
                listener(snapshot);
            } catch (e) {
                console.error('Connection status listener failed:', e);
            }
        });
    }

    /** TURN servers from the ICE config, one entry per URL (credentials kept internal). */
    private getTurnServers(): TurnServerEntry[] {
        const result: TurnServerEntry[] = [];
        (this.options.iceServers || []).forEach((server: any) => {
            const urls: string[] = Array.isArray(server.urls) ? server.urls : [server.urls];
            urls.forEach((url) => {
                if (typeof url === 'string' && /^turns?:/i.test(url)) {
                    result.push({ url, username: server.username, credential: server.credential });
                }
            });
        });
        return result;
    }

    /**
     * Check each configured TURN server by asking it for a relay allocation, with a
     * relay-only ICE policy so nothing else can satisfy the check. Concurrent callers
     * share one run.
     */
    public probeTurnServers(): Promise<TurnProbeResult[]> {
        if (this.turnProbePromise) return this.turnProbePromise;
        const servers = this.getTurnServers();
        this.turnProbe = servers.map((s) => ({ url: s.url, status: 'checking' as const }));
        this.turnProbePromise = Promise.all(servers.map((server, i) =>
            this.probeTurnServer(server).then((result) => {
                this.turnProbe[i] = result;
                return result;
            })
        )).then((results) => {
            this.turnProbeAt = Date.now();
            this.turnProbePromise = null;
            return results;
        });
        return this.turnProbePromise;
    }

    private probeTurnServer(server: TurnServerEntry): Promise<TurnProbeResult> {
        return new Promise((resolve) => {
            const started = Date.now();
            let pc: RTCPeerConnection;
            try {
                pc = new RTCPeerConnection({
                    iceServers: [{ urls: server.url, username: server.username, credential: server.credential }],
                    iceTransportPolicy: 'relay'
                });
            } catch (e) {
                resolve({ url: server.url, status: 'failed', error: 'Invalid TURN configuration', checkedAt: Date.now() });
                return;
            }

            let done = false;
            let lastError: string | undefined;
            const finish = (result: Partial<TurnProbeResult>) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                try {
                    pc.close();
                } catch (e) {
                    // Ignore
                }
                resolve({ url: server.url, status: 'failed', ...result, checkedAt: Date.now() } as TurnProbeResult);
            };
            const timer = setTimeout(() => {
                finish({ status: 'failed', error: lastError || 'No response from the TURN server' });
            }, WebRTCTransport.TURN_PROBE_TIMEOUT_MS);

            pc.onicecandidate = (event) => {
                const candidate = event.candidate && event.candidate.candidate;
                if (candidate && / typ relay /.test(candidate)) {
                    const parts = candidate.split(' ');
                    finish({
                        status: 'ok',
                        allocationMs: Date.now() - started,
                        relayAddress: parts[4] + ':' + parts[5]
                    });
                } else if (!event.candidate) {
                    finish({ status: 'failed', error: lastError || 'No relay address was allocated' });
                }
            };
            (pc as any).onicecandidateerror = (event: any) => {
                lastError = describeIceError(event.errorCode, event.errorText);
            };

            pc.createDataChannel('turn-probe');
            pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer))
                .catch((err) => finish({ status: 'failed', error: String(err && err.message || err) }));
        });
    }

    /** Route, protocol and RTT of a data connection, from its selected ICE candidate pair. */
    private async getLinkDiagnostics(conn: any, peerId: string, lastSeen: number): Promise<PeerLinkDiagnostics> {
        const link: PeerLinkDiagnostics = {
            peerId,
            open: !!(conn && conn.open),
            route: 'unknown',
            lastSeenMsAgo: lastSeen ? Date.now() - lastSeen : undefined
        };
        const pc: RTCPeerConnection = conn && conn.peerConnection;
        if (!pc || typeof pc.getStats !== 'function') return link;

        try {
            const stats = await pc.getStats();
            let pair: any = null;
            stats.forEach((s: any) => {
                if (!pair && s.type === 'transport' && s.selectedCandidatePairId) {
                    pair = stats.get(s.selectedCandidatePairId);
                }
            });
            if (!pair) {
                // Firefox flags the pair as selected; Safari may only mark it nominated.
                stats.forEach((s: any) => {
                    if (!pair && s.type === 'candidate-pair' &&
                        (s.selected || (s.nominated && s.state === 'succeeded'))) {
                        pair = s;
                    }
                });
            }
            if (!pair) return link;

            const local: any = stats.get(pair.localCandidateId) || {};
            const remote: any = stats.get(pair.remoteCandidateId) || {};
            link.localCandidateType = local.candidateType;
            link.remoteCandidateType = remote.candidateType;
            if (typeof pair.currentRoundTripTime === 'number') {
                link.rttMs = Math.round(pair.currentRoundTripTime * 1000);
            }

            const localRelay = local.candidateType === 'relay';
            const remoteRelay = remote.candidateType === 'relay';
            if (localRelay || remoteRelay) {
                link.route = 'relay';
                link.relayedBy = localRelay && remoteRelay ? 'both' : (localRelay ? 'this-device' : 'peer');
                if (localRelay) {
                    // e.g. 'turn:host:3478?transport=udp' -> 'host:3478' (protocol is reported separately).
                    link.relayServer = typeof local.url === 'string'
                        ? local.url.replace(/^turns?:/i, '').split('?')[0]
                        : undefined;
                    link.protocol = local.relayProtocol || local.protocol;
                } else {
                    link.protocol = local.protocol;
                }
            } else {
                link.route = local.candidateType === 'host' && remote.candidateType === 'host' ? 'lan' : 'direct';
                link.protocol = local.protocol;
            }
        } catch (e) {
            // Stats unavailable; report what we know.
        }
        return link;
    }

    /** Snapshot of signaling, TURN reachability and data-link routing for the status views. */
    public async getDiagnostics(): Promise<NetworkDiagnostics> {
        const isHost = this.session ? this.session.isHost() : false;
        const turnServers = this.getTurnServers();

        // Kick off (or refresh) the TURN probe in the background; callers poll.
        if (turnServers.length > 0 && !this.turnProbePromise &&
            Date.now() - this.turnProbeAt > WebRTCTransport.TURN_PROBE_TTL_MS) {
            this.probeTurnServers();
        }

        let signaling: NetworkDiagnostics['signaling'] = 'connecting';
        if (!this.peer || this.peer.destroyed || this.peer.disconnected) {
            signaling = 'disconnected';
        } else if (this.peer.open) {
            signaling = 'connected';
        }

        const diagnostics: NetworkDiagnostics = {
            role: isHost ? 'host' : 'client',
            peerId: this.clientId,
            signaling,
            turnConfigured: turnServers.length > 0,
            turn: this.turnProbe.map((r) => ({ ...r }))
        };

        if (isHost) {
            const clients: { [clientId: string]: PeerLinkDiagnostics } = {};
            await Promise.all(Object.keys(this.connections).map(async (clientId) => {
                const conn = this.connections[clientId];
                clients[clientId] = await this.getLinkDiagnostics(conn, clientId, conn && conn.__mpLastSeen);
            }));
            diagnostics.clients = clients;
        } else {
            diagnostics.host = this.hostConnection
                ? await this.getLinkDiagnostics(this.hostConnection, this.roomId, this.lastHostSeen)
                : { peerId: this.roomId, open: false, route: 'unknown' };
            diagnostics.host.open = this.isHostLinkAlive();
            diagnostics.status = { ...this.status };
        }
        return diagnostics;
    }

    public isConnected(): boolean {
        const isHost = this.session ? this.session.isHost() : false;
        if (isHost) {
            return !!(this.peer && this.peer.open && !this.peer.disconnected && !this.peer.destroyed);
        } else {
            return this.isHostLinkAlive();
        }
    }

    public disconnect(kicked?: boolean): void {
        if (kicked) {
            this.kicked = true;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.clearConnectTimeout();
        this.clearSignalingRetry();
        this.detachNetworkListeners();
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.markHostDisconnected();
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
