/**
 * NetworkStatus.tsx
 *
 * Network diagnostics for the game shell: signaling, TURN relay reachability and how
 * each data link is routed (same network / peer-to-peer / relayed through TURN).
 *
 *  - The host sees this on the Clients view, plus a route badge on every player card.
 *  - Clients get their own Network view (opened from the status dot), showing the link
 *    to the host and any reconnection attempts in progress.
 *
 * Data comes from MP.getNetworkDiagnostics(), which only peer-to-peer transports
 * implement; other transports show a short "not available" note instead.
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import type {
    ConnectionStatus,
    NetworkDiagnostics,
    PeerLinkDiagnostics,
    TurnProbeResult
} from '../../common/interfaces';

const POLL_MS = 1500;

/**
 * Polls MP.getNetworkDiagnostics() while `isVisible()` is true. Shell views stay mounted
 * when hidden, so visibility gating keeps hidden views from probing TURN or reading stats.
 */
export class DiagnosticsPoller {
    private timer: any = null;
    private inFlight = false;

    constructor(
        private getMP: () => any,
        private isVisible: () => boolean,
        private onUpdate: (diagnostics: NetworkDiagnostics | null, supported: boolean) => void
    ) {}

    public start() {
        if (this.timer) return;
        this.tick();
        this.timer = setInterval(() => this.tick(), POLL_MS);
    }

    public stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    public tick() {
        if (this.inFlight) return;
        if (typeof document !== 'undefined' && document.hidden) return;
        if (!this.isVisible()) return;

        const mp = this.getMP();
        const pending = mp && mp.getNetworkDiagnostics ? mp.getNetworkDiagnostics() : null;
        if (!pending) {
            this.onUpdate(null, false);
            return;
        }
        this.inFlight = true;
        pending
            .then((diagnostics: NetworkDiagnostics) => this.onUpdate(diagnostics, true))
            .catch((e: any) => {
                console.warn('Network diagnostics failed:', e);
            })
            .then(() => {
                this.inFlight = false;
            });
    }
}

/** True when the element is rendered (not inside a display:none shell tab). */
export function isElementVisible(el: HTMLElement | null): boolean {
    return !!(el && el.offsetParent !== null);
}

type Tone = 'good' | 'warn' | 'bad' | 'relay' | 'neutral';

function describeTurnUrl(url: string): { host: string, transport: string } {
    const withoutScheme = url.replace(/^turns?:/i, '');
    const [hostPort, query] = withoutScheme.split('?');
    let transport = /^turns:/i.test(url) ? 'TLS' : 'UDP';
    if (query && /transport=tcp/i.test(query)) transport = /^turns:/i.test(url) ? 'TLS' : 'TCP';
    return { host: hostPort, transport };
}

function formatAgo(ms?: number): string {
    if (ms === undefined || ms === null) return '—';
    if (ms < 1500) return 'just now';
    const s = Math.round(ms / 1000);
    if (s < 60) return s + 's ago';
    return Math.round(s / 60) + 'm ago';
}

/**
 * How a link is routed, worded for the viewer: the host's view of a player, or a
 * player's view of the host.
 */
export function describeRoute(link: PeerLinkDiagnostics | undefined, viewer: 'host' | 'client'):
    { text: string, detail?: string, tone: Tone } {
    if (!link || !link.open) {
        return { text: 'Not connected', tone: 'bad' };
    }
    const rtt = typeof link.rttMs === 'number' ? link.rttMs + ' ms' : undefined;
    switch (link.route) {
        case 'lan':
            return { text: 'Direct · same network', detail: rtt, tone: 'good' };
        case 'direct':
            return { text: 'Direct · peer-to-peer', detail: rtt, tone: 'good' };
        case 'relay': {
            let side = 'both sides';
            if (link.relayedBy === 'this-device') side = viewer === 'host' ? "host's side" : 'your side';
            if (link.relayedBy === 'peer') side = viewer === 'host' ? "player's side" : "host's side";
            const protocol = link.protocol ? link.protocol.toUpperCase() : undefined;
            const detail = [side, protocol, rtt].filter(Boolean).join(' · ');
            return { text: 'Relayed via TURN', detail, tone: 'relay' };
        }
        default:
            return { text: 'Connected', detail: rtt, tone: 'good' };
    }
}

export class RouteBadge extends React.Component<{ link?: PeerLinkDiagnostics, viewer: 'host' | 'client' }, {}> {
    public render() {
        const route = describeRoute(this.props.link, this.props.viewer);
        const title = this.props.link && this.props.link.relayServer
            ? 'Relay server: ' + this.props.link.relayServer
            : undefined;
        return (
            <span className={'net-route-pill ' + route.tone} title={title}>
                <FontAwesomeIcon icon={route.tone === 'relay' ? 'server' : 'wifi'} className="net-route-icon" />
                {route.text}
                {route.detail ? <span className="net-route-detail">{route.detail}</span> : null}
            </span>
        );
    }
}

function describeConnectionStatus(status: ConnectionStatus | undefined, now: number):
    { text: string, tone: Tone } {
    if (!status) return { text: 'Unknown', tone: 'neutral' };
    const of = status.maxAttempts ? ` of ${status.maxAttempts}` : '';
    switch (status.phase) {
        case 'connected':
            return { text: 'Connected', tone: 'good' };
        case 'signaling':
            return { text: 'Connecting to the signaling server…', tone: 'warn' };
        case 'connecting':
            return {
                text: (status.reconnecting ? 'Reconnecting' : 'Connecting') + ` — attempt ${status.attempt}${of}`,
                tone: 'warn'
            };
        case 'waiting-retry': {
            const secs = status.nextRetryAt ? Math.max(0, Math.ceil((status.nextRetryAt - now) / 1000)) : 0;
            return { text: `Attempt ${status.attempt}${of} failed — retrying in ${secs}s`, tone: 'warn' };
        }
        case 'failed':
            return { text: 'Could not connect', tone: 'bad' };
        default:
            return { text: 'Unknown', tone: 'neutral' };
    }
}

interface NetworkPanelProps {
    diagnostics: NetworkDiagnostics | null;
    supported: boolean;
    retesting: boolean;
    onRetest: () => void;
}

/** Signaling + TURN section, shared by the host Clients view and the client Network view. */
export class NetworkPanel extends React.Component<NetworkPanelProps, {}> {
    private renderTurnRow(result: TurnProbeResult, i: number) {
        const { host, transport } = describeTurnUrl(result.url);
        let pill: React.ReactElement;
        let detail: string | undefined;
        if (result.status === 'checking') {
            pill = <span className="net-pill warn">Checking…</span>;
        } else if (result.status === 'ok') {
            pill = <span className="net-pill good">Reachable</span>;
            detail = [
                typeof result.allocationMs === 'number' ? `relay ready in ${result.allocationMs} ms` : undefined,
                result.relayAddress ? `relay ${result.relayAddress}` : undefined
            ].filter(Boolean).join(' · ');
        } else {
            pill = <span className="net-pill bad">Unreachable</span>;
            detail = result.error;
        }
        return (
            <div className="net-row" key={'turn-' + i}>
                <span className="net-row-label">
                    <span className="monospace">{host}</span>
                    <span className="net-transport">{transport}</span>
                </span>
                <span className="net-row-value">
                    {pill}
                    {detail ? <span className="net-row-detail">{detail}</span> : null}
                </span>
            </div>
        );
    }

    public render() {
        const { diagnostics, supported } = this.props;

        if (!supported) {
            return (
                <div className="net-section">
                    <h3 className="net-title"><FontAwesomeIcon icon="wifi" style={{ marginRight: '8px' }} />Network</h3>
                    <div className="net-empty">Network diagnostics are only available for peer-to-peer games.</div>
                </div>
            );
        }
        if (!diagnostics) {
            return (
                <div className="net-section">
                    <h3 className="net-title"><FontAwesomeIcon icon="wifi" style={{ marginRight: '8px' }} />Network</h3>
                    <div className="net-empty">Checking network…</div>
                </div>
            );
        }

        const signalingTone: Tone = diagnostics.signaling === 'connected' ? 'good'
            : diagnostics.signaling === 'connecting' ? 'warn' : 'bad';
        const signalingText = diagnostics.signaling === 'connected' ? 'Connected'
            : diagnostics.signaling === 'connecting' ? 'Connecting…' : 'Disconnected';
        const anyChecking = diagnostics.turn.some((t) => t.status === 'checking');

        return (
            <div className="net-section">
                <h3 className="net-title">
                    <FontAwesomeIcon icon="wifi" style={{ marginRight: '8px' }} />
                    Network
                    <span className="net-subtitle">
                        {diagnostics.role === 'host' ? 'hosting as ' : 'you are '}{diagnostics.peerId}
                    </span>
                </h3>

                <div className="net-row">
                    <span className="net-row-label">Signaling server</span>
                    <span className="net-row-value">
                        <span className={'net-pill ' + signalingTone}>{signalingText}</span>
                        <span className="net-row-detail">used to find and (re)connect to other devices</span>
                    </span>
                </div>

                <div className="net-subhead">
                    TURN relay servers
                    {diagnostics.turnConfigured ? (
                        <button
                            className="net-retest-btn"
                            disabled={this.props.retesting || anyChecking}
                            onClick={this.props.onRetest}
                            title="Ask each TURN server for a relay allocation again."
                        >
                            <FontAwesomeIcon icon="rotate-right" spin={this.props.retesting || anyChecking} style={{ marginRight: '6px' }} />
                            Re-test
                        </button>
                    ) : null}
                </div>
                {diagnostics.turnConfigured ? (
                    diagnostics.turn.length > 0
                        ? diagnostics.turn.map((r, i) => this.renderTurnRow(r, i))
                        : <div className="net-empty">Checking TURN servers…</div>
                ) : (
                    <div className="net-warning">
                        No TURN server is configured for this build. Players on strict mobile or
                        corporate networks may be unable to connect.
                    </div>
                )}
            </div>
        );
    }
}

/** Client-only "connection to host" block. */
export class HostLinkPanel extends React.Component<{ diagnostics: NetworkDiagnostics | null }, {}> {
    public render() {
        const d = this.props.diagnostics;
        if (!d || d.role !== 'client') return null;
        const status = describeConnectionStatus(d.status, Date.now());
        const link = d.host;
        const lastError = d.status && d.status.phase !== 'connected' ? d.status.lastError : undefined;
        const hostId = link && link.peerId ? link.peerId : '—';

        return (
            <div className="net-section">
                <h3 className="net-title">
                    <FontAwesomeIcon icon="users" style={{ marginRight: '8px' }} />
                    Connection to host
                    <span className="net-subtitle">room {hostId}</span>
                </h3>
                <div className="net-row">
                    <span className="net-row-label">Status</span>
                    <span className="net-row-value">
                        <span className={'net-pill ' + status.tone}>{status.text}</span>
                    </span>
                </div>
                <div className="net-row">
                    <span className="net-row-label">Route</span>
                    <span className="net-row-value">
                        <RouteBadge link={link} viewer="client" />
                        {link && link.relayServer ? (
                            <span className="net-row-detail">via {link.relayServer}</span>
                        ) : null}
                    </span>
                </div>
                <div className="net-row">
                    <span className="net-row-label">Last heard from host</span>
                    <span className="net-row-value">{formatAgo(link && link.lastSeenMsAgo)}</span>
                </div>
                {lastError ? (
                    <div className="net-warning">{lastError}</div>
                ) : null}
            </div>
        );
    }
}

/** The client's Network view (opened from the status dot in the bottom-left). */
export class ClientNetworkView extends React.Component<
    { MP: any },
    { diagnostics: NetworkDiagnostics | null, supported: boolean, retesting: boolean }
> {
    private root = React.createRef<HTMLDivElement>();
    private poller: DiagnosticsPoller;

    constructor(props: any) {
        super(props);
        this.state = { diagnostics: null, supported: true, retesting: false };
        this.poller = new DiagnosticsPoller(
            () => this.props.MP,
            () => isElementVisible(this.root.current),
            (diagnostics, supported) => this.setState({ diagnostics, supported })
        );
    }

    public componentDidMount() {
        this.poller.start();
    }

    public componentWillUnmount() {
        this.poller.stop();
    }

    private retest = () => {
        const mp = this.props.MP;
        const pending = mp && mp.retestTurnServers ? mp.retestTurnServers() : null;
        if (!pending) return;
        this.setState({ retesting: true });
        this.poller.tick();
        pending.then(() => {
            this.setState({ retesting: false });
            this.poller.tick();
        }, () => this.setState({ retesting: false }));
    };

    public render() {
        return (
            <div className="lobby-roommanagement-container net-view" ref={this.root}>
                <div className="lobby-roommanagement-header">
                    <h2 className="lobby-roommanagement-title">
                        <FontAwesomeIcon icon="wifi" style={{ marginRight: '10px', color: '#3498db' }} />
                        Network Status
                    </h2>
                </div>
                <HostLinkPanel diagnostics={this.state.diagnostics} />
                <NetworkPanel
                    diagnostics={this.state.diagnostics}
                    supported={this.state.supported}
                    retesting={this.state.retesting}
                    onRetest={this.retest}
                />
            </div>
        );
    }
}
