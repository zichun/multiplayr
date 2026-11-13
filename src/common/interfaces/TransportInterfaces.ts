/**
 * TransportInterfaces.ts
 */

import {
    ReturnPacketType,
    CallbackType,
    PacketType
} from './PacketInterfaces';

import {
    ClientSessionInterface
} from './SessionInterfaces';

export interface ClientTransportInterface {
    getClientId(): string;
    updateClientId();
    sendMessage(packet: PacketType, cb?: CallbackType<ReturnPacketType>);
    setSession(session: ClientSessionInterface);
    isConnected(): boolean;
    disconnect(kicked?: boolean): void;
    /** Optional: detailed network diagnostics (only peer-to-peer transports implement it). */
    getDiagnostics?(): Promise<NetworkDiagnostics>;
    /** Optional: re-run the TURN server reachability probe. */
    probeTurnServers?(): Promise<TurnProbeResult[]>;
}

/**
 * How a data channel is routed, from the selected ICE candidate pair:
 *  - 'lan':     both ends are host candidates (same local network)
 *  - 'direct':  peer-to-peer through NAT (STUN), no relay
 *  - 'relay':   at least one end goes through a TURN server
 */
export type LinkRoute = 'lan' | 'direct' | 'relay' | 'unknown';

export interface PeerLinkDiagnostics {
    peerId: string;
    open: boolean;
    route: LinkRoute;
    /** Which side(s) relay through TURN, when route is 'relay'. */
    relayedBy?: 'this-device' | 'peer' | 'both';
    /** TURN URL used by this device's relay candidate, when known. */
    relayServer?: string;
    /** Transport protocol between this device and the relay ('udp' | 'tcp' | 'tls'), or of the direct path. */
    protocol?: string;
    localCandidateType?: string;
    remoteCandidateType?: string;
    /** Round-trip time of the selected path, in milliseconds. */
    rttMs?: number;
    /** Milliseconds since anything was last received on this link. */
    lastSeenMsAgo?: number;
}

export interface TurnProbeResult {
    /** TURN URL (credentials are never included). */
    url: string;
    status: 'checking' | 'ok' | 'failed';
    /** Time to obtain a relay allocation, in milliseconds. */
    allocationMs?: number;
    /** Relay address the server handed out (public IP:port). */
    relayAddress?: string;
    error?: string;
    checkedAt?: number;
}

/** Client-side connection progress, for the join page and the client network view. */
export interface ConnectionStatus {
    phase: 'signaling' | 'connecting' | 'waiting-retry' | 'connected' | 'failed';
    /** 1-based attempt number of the current/most recent host connection attempt. */
    attempt: number;
    /** Attempt budget while the first join is pending; undefined once reconnecting without limit. */
    maxAttempts?: number;
    /** When the next retry fires (epoch ms), in 'waiting-retry'. */
    nextRetryAt?: number;
    /** Why the last attempt failed, in plain words. */
    lastError?: string;
    /** True once this client has been connected at least once (later drops are reconnects). */
    reconnecting?: boolean;
}

export interface NetworkDiagnostics {
    role: 'host' | 'client';
    peerId: string;
    signaling: 'connected' | 'connecting' | 'disconnected';
    turnConfigured: boolean;
    turn: TurnProbeResult[];
    /** Client only: the link to the host. */
    host?: PeerLinkDiagnostics;
    /** Client only: connection progress / retry state. */
    status?: ConnectionStatus;
    /** Host only: links to each connected client, keyed by client ID. */
    clients?: { [clientId: string]: PeerLinkDiagnostics };
}

export interface ServerTransportInterface {
    sendMessage(data: PacketType, cb?: CallbackType<ReturnPacketType>);
}
