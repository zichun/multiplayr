/**
 * gameshell.ts
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Sound from 'react-sound';

//import { Panel } from 'office-ui-fabric-react/lib/Panel';
//import { Button } from 'office-ui-fabric-react/lib/Button';

import './shell.scss';
import { icons } from '../lobby/LobbyView';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

import { forEach } from '../../common/utils';

export interface ToastNotification {
    id: string;
    message: string;
    bgColor?: string;
    sound?: string;
    duration?: number;
}

interface HostShellMainInterface extends ViewPropsInterface {
    links: any,
    currentView?: string,
    topBarContent?: any,
    gameName?: string,
    toastNotification?: ToastNotification | null
}

interface HostShellMainState {
    currentView: string;
    toast: {
        id: string;
        message: string;
        bgColor: string;
        fadingOut: boolean;
    } | null;
    soundToPlay: string | null;
    soundKey: string | null;
}

interface HostShellMainPanelInterface extends ViewPropsInterface {
    links: any,
    setView: any,
    currentView: string
}

export const Shell: GameRuleInterface = {

    name: 'gameshell',

    plugins: {},
    methods: {},

    globalData: {},
    playerData: {},

    onDataChange: (mp: MPType) => {
        return false;
    },

    views: {
        'HostShell-Main': class extends React.Component<HostShellMainInterface, HostShellMainState> {
            private toastTimer: any = null;
            private fadeTimer: any = null;

            constructor (props: HostShellMainInterface) {
                super(props);
                this.state = {
                    currentView: 'home',
                    toast: null,
                    soundToPlay: null,
                    soundKey: null
                };
            }

            componentDidMount() {
                if (this.props.toastNotification) {
                    this.triggerToast(this.props.toastNotification);
                }
            }

            componentDidUpdate(prevProps: HostShellMainInterface) {
                const { toastNotification } = this.props;
                if (toastNotification && toastNotification.id !== prevProps.toastNotification?.id) {
                    this.triggerToast(toastNotification);
                }
            }

            componentWillUnmount() {
                if (this.toastTimer) clearTimeout(this.toastTimer);
                if (this.fadeTimer) clearTimeout(this.fadeTimer);
            }

            private triggerToast(toastNotification: ToastNotification) {
                if (this.toastTimer) clearTimeout(this.toastTimer);
                if (this.fadeTimer) clearTimeout(this.fadeTimer);

                const message = toastNotification.message;
                const bgColor = toastNotification.bgColor || '#2c3e50';
                const sound = toastNotification.sound || null;
                const duration = toastNotification.duration !== undefined ? toastNotification.duration : 3000;

                this.setState({
                    toast: {
                        id: toastNotification.id,
                        message,
                        bgColor,
                        fadingOut: false
                    },
                    soundToPlay: sound,
                    soundKey: toastNotification.id
                });

                if (duration > 0) {
                    this.toastTimer = setTimeout(() => {
                        this.startFadeOut();
                    }, duration);
                }
            }

            private startFadeOut() {
                if (!this.state.toast || this.state.toast.fadingOut) return;

                this.setState(prevState => {
                    if (!prevState.toast) return null;
                    return {
                        toast: {
                            ...prevState.toast,
                            fadingOut: true
                        }
                    };
                });

                if (this.fadeTimer) clearTimeout(this.fadeTimer);
                this.fadeTimer = setTimeout(() => {
                    this.setState({ toast: null });
                }, 500);
            }

            private handleToastClick = () => {
                if (this.toastTimer) clearTimeout(this.toastTimer);
                this.startFadeOut();
            };

            private _setView(viewName: string) {
                this.setState({ currentView: viewName });
            }

            public render() {
                const links = { ...this.props.links };
                const isHost = this.props.MP && this.props.MP.getConnectionInfo && this.props.MP.getConnectionInfo().isHost;

                if (isHost && !links['shell-clients']) {
                    links['shell-clients'] = {
                        icon: 'users',
                        label: 'Clients',
                        view: React.createElement(Shell.views['ConnectedClientsView'], {
                            MP: this.props.MP
                        })
                    };
                }

                const header = React.createElement(
                    Shell.views['HostShell-Main-Head'],
                    {
                        topBarContent: this.props.topBarContent,
                        roomId: this.props.MP.roomId,
                        gameName: this.props.gameName ?? '',
                    });

                const body = React.createElement(Shell.views['HostShell-Main-Body'], {
                    links: links,
                    currentView: this.state.currentView
                });

                const panel = React.createElement(Shell.views['HostShell-Main-Panel'], {
                    links: links,
                    setView: this._setView.bind(this),
                    currentView: this.state.currentView,
                    MP: this.props.MP
                });

                return (
                    <div className='shell-main'>
                        {/* Toast Notification Banner */}
                        {this.state.toast && (
                            <div
                                className={`shell-toast-banner ${this.state.toast.fadingOut ? 'fade-out' : ''}`}
                                style={{ backgroundColor: this.state.toast.bgColor }}
                                onClick={this.handleToastClick}
                            >
                                <span className="toast-icon">📢</span>
                                <span>{this.state.toast.message}</span>
                            </div>
                        )}

                        {/* Sound Player */}
                        {this.state.soundToPlay && (
                            <Sound
                                key={this.state.soundKey}
                                url={this.state.soundToPlay}
                                playStatus="PLAYING"
                                onFinishedPlaying={() => this.setState({ soundToPlay: null, soundKey: null })}
                            />
                        )}

                        { header }
                        { panel }
                        { body }
                    </div>
                );
            }
        },

        'HostShell-Main-Panel': class extends React.Component<
            HostShellMainPanelInterface & { MP?: any },
            { showPanel: boolean, status: string, tooltip: string }
        > {
            private _interval: any = null;

            constructor(props: any) {
                super(props);
                const info = props.MP && props.MP.getConnectionInfo ? props.MP.getConnectionInfo() : { status: 'red', tooltip: 'Disconnected' };
                this.state = {
                    showPanel: false,
                    status: info.status,
                    tooltip: info.tooltip
                };
                this._togglePanel = this._togglePanel.bind(this);
            }

            private _togglePanel() {
                this.setState({ showPanel: !this.state.showPanel });
            }

            public componentDidMount() {
                this._interval = setInterval(() => {
                    if (this.props.MP && this.props.MP.getConnectionInfo) {
                        const info = this.props.MP.getConnectionInfo();
                        if (info.status !== this.state.status || info.tooltip !== this.state.tooltip) {
                            this.setState({ status: info.status, tooltip: info.tooltip });
                        }
                    }
                }, 1000);
            }

            public componentWillUnmount() {
                if (this._interval) {
                    clearInterval(this._interval);
                }
            }

            public render() {
                const icons = [];
                const labels = [];

                forEach(
                    this.props.links,
                    (linkName: string, linkObj: any) => {
                        if (linkName === 'shell-clients') return;

                        let className = 'icon';

                        if (this.props.currentView === linkName) {
                            className += ' active';
                        }

                        icons.push(
                            <div className='shell-main-panel-link'
                                 onClick={ this.props.setView.bind(this, linkName) }
                                 key={ 'link-' + linkName }>

                                <FontAwesomeIcon icon={ linkObj.icon }
                                             className={ className }
                                             size='1x'
                                             key={ 'icon-' + linkName } />
                                <label>{ linkObj.label }</label>
                            </div>
                        );
                        labels.push();
                    });

                const pannelExtensionClassName = this.state.showPanel ?
                                                 'shell-main-panel show' :
                                                 'shell-main-panel';
                const info = this.props.MP && this.props.MP.getConnectionInfo ? this.props.MP.getConnectionInfo() : { isHost: false };
                const isHost = info.isHost;

                return (
                    <div className={ pannelExtensionClassName }>
                        <div className='shell-main-panel-link'
                             onClick={ this._togglePanel }>

                            <FontAwesomeIcon icon="bars"
                                         size='1x'
                                         className='icon menu' />
                        </div>
                        { icons }

                        <div className="shell-status-container" 
                             onClick={ isHost ? this.props.setView.bind(this, 'shell-clients') : undefined }
                             style={{ cursor: isHost ? 'pointer' : 'help' }}>
                            <span className={`shell-status-dot ${this.state.status}`} title={this.state.tooltip}></span>
                        </div>
                    </div>
                );
            }
        },

        'HostShell-Main-Head': class extends React.Component<
            ViewPropsInterface & { topBarContent: any, gameName: string, roomId: string},
            { copied: boolean }
        > {
            constructor(props: any) {
                super(props);
                this.state = { copied: false };
                this.copyRoomId = this.copyRoomId.bind(this);
            }
            public copyRoomId() {
                const protocol = window.location.protocol;
                const host = window.location.host;
                const pathname = window.location.pathname;

                let joinPath = "/join";
                if (pathname.indexOf("host_p2p.html") >= 0) {
                    joinPath = pathname.replace("host_p2p.html", "join_p2p.html");
                } else if (pathname.indexOf("host_p2p") >= 0) {
                    joinPath = pathname.replace("host_p2p", "join_p2p");
                } else if (pathname.indexOf("host.html") >= 0) {
                    joinPath = pathname.replace("host.html", "join.html");
                } else if (pathname.indexOf("host") >= 0) {
                    joinPath = pathname.replace("host", "join");
                }

                const url = protocol + "//" + host + joinPath + "#roomId=" + this.props.roomId;

                const reportSuccess = () => {
                    this.setState({ copied: true });
                    setTimeout(() => {
                        this.setState({ copied: false });
                    }, 1500);
                };

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url)
                        .then(reportSuccess)
                        .catch((err) => {
                            console.error('Async: Could not copy text: ', err);
                            this.fallbackCopyText(url);
                            reportSuccess();
                        });
                } else {
                    this.fallbackCopyText(url);
                    reportSuccess();
                }
            }
            private fallbackCopyText(text: string) {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                
                textArea.style.position = "fixed";
                textArea.style.top = "0";
                textArea.style.left = "0";
                
                textArea.style.width = "2em";
                textArea.style.height = "2em";
                textArea.style.padding = "0";
                textArea.style.border = "none";
                textArea.style.outline = "none";
                textArea.style.boxShadow = "none";
                textArea.style.background = "transparent";
                
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                }

                document.body.removeChild(textArea);
            }
            public render() {
                let topbar = null;
                if (!this.props.topBarContent) {
                    const text = this.state.copied ? "Copied!" : this.props.roomId;
                    topbar = (<div className="room-id" onClick={ this.copyRoomId }>{ text }</div>);
                } else {
                    topbar = this.props.topBarContent;
                }
                return (
                    <div className='shell-header'>
                        <div className='shell-room'>
                            { topbar }
                        </div>
                        <div className='shell-title'>
                            { this.props.gameName }
                        </div>
                    </div>
                );
            }
        },

        'HostShell-Main-Body': class extends React.Component<ViewPropsInterface & {
            currentView: string,
            links: any
        }, {}> {
            public render() {
                const content = this.props.links[this.props.currentView.toLowerCase()].view;
                const childViews = [];

                forEach(
                    this.props.links,
                    (key, obj) => {
                        let style = {};
                        if (key !== this.props.currentView.toLowerCase()) {
                            style = { display: 'none' };
                        }

                        childViews.push(
                            <div className='shell-body-container'
                                 style={ style }
                                 key={ key }>
                                { obj.view }
                            </div>
                        );
                    });

                return (
                    <div className='shell-body'>
                        { childViews }
                    </div>
                );
            }
        },

        'HostShell-Main-Body-Menu': class extends React.Component<ViewPropsInterface & {
            links: any,
            setView: any
        }, {}> {
            constructor(props: any) {
                super(props);
                this.setView = this.setView.bind(this);
            }

            public setView(e: any) {
                this.props.setView(e.target.innerText);
            }

            public render() {
                const tr = [React.createElement('li', { onClick: this.setView, key: 'home' }, 'Home')];
                for (let i = 0; i < this.props.links.length; i = i + 1) {
                    tr.push(React.createElement('li', { onClick: this.setView, key: ('link-' + i) }, this.props['links'][i]));
                }
                return React.createElement(
                    'li',
                    { className: 'shell-navigation' },
                    tr);
            }
        },

        'ConnectedClientsView': class extends React.Component<
            ViewPropsInterface,
            { copied: boolean, copiedClientId: string | null }
        > {
            constructor(props: any) {
                super(props);
                this.state = { copied: false, copiedClientId: null };
                this.copyRoomId = this.copyRoomId.bind(this);
            }

            public copyRoomId() {
                const mp = this.props.MP;
                const roomId = mp.roomId;
                const protocol = window.location.protocol;
                const host = window.location.host;
                const pathname = window.location.pathname;

                let joinPath = "/join";
                if (pathname.indexOf("host_p2p.html") >= 0) {
                    joinPath = pathname.replace("host_p2p.html", "join_p2p.html");
                } else if (pathname.indexOf("host_p2p") >= 0) {
                    joinPath = pathname.replace("host_p2p", "join_p2p");
                } else if (pathname.indexOf("host.html") >= 0) {
                    joinPath = pathname.replace("host.html", "join.html");
                } else if (pathname.indexOf("host") >= 0) {
                    joinPath = pathname.replace("host", "join");
                }

                const url = protocol + "//" + host + joinPath + "#roomId=" + roomId;

                const reportSuccess = () => {
                    this.setState({ copied: true });
                    setTimeout(() => {
                        this.setState({ copied: false });
                    }, 1500);
                };

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url)
                        .then(reportSuccess)
                        .catch((err) => {
                            console.error('Async: Could not copy text: ', err);
                            this.fallbackCopyText(url);
                            reportSuccess();
                        });
                } else {
                    this.fallbackCopyText(url);
                    reportSuccess();
                }
            }

            public copyPlayerJoinLink(clientId: string) {
                const mp = this.props.MP;
                const roomId = mp.roomId;
                const protocol = window.location.protocol;
                const host = window.location.host;
                const pathname = window.location.pathname;

                let joinPath = "/join";
                if (pathname.indexOf("host_p2p.html") >= 0) {
                    joinPath = pathname.replace("host_p2p.html", "join_p2p.html");
                } else if (pathname.indexOf("host_p2p") >= 0) {
                    joinPath = pathname.replace("host_p2p", "join_p2p");
                } else if (pathname.indexOf("host.html") >= 0) {
                    joinPath = pathname.replace("host.html", "join.html");
                } else if (pathname.indexOf("host") >= 0) {
                    joinPath = pathname.replace("host", "join");
                }

                const url = protocol + "//" + host + joinPath + "#roomId=" + roomId + "&clientId=" + clientId;

                const reportSuccess = () => {
                    this.setState({ copiedClientId: clientId });
                    setTimeout(() => {
                        this.setState({ copiedClientId: null });
                    }, 1500);
                };

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url)
                        .then(reportSuccess)
                        .catch((err) => {
                            console.error('Async: Could not copy text: ', err);
                            this.fallbackCopyText(url);
                            reportSuccess();
                        });
                } else {
                    this.fallbackCopyText(url);
                    reportSuccess();
                }
            }

            private fallbackCopyText(text: string) {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.top = "0";
                textArea.style.left = "0";
                textArea.style.width = "2em";
                textArea.style.height = "2em";
                textArea.style.padding = "0";
                textArea.style.border = "none";
                textArea.style.outline = "none";
                textArea.style.boxShadow = "none";
                textArea.style.background = "transparent";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                }
                document.body.removeChild(textArea);
            }

            public render() {
                const mp = this.props.MP;
                if (!mp) return null;

                const roomId = mp.roomId;
                const ruleName = mp.ruleName || 'Game';

                const playersInfo = mp.getLobbyPlayersInfo ? mp.getLobbyPlayersInfo() : [];

                const rows = [];
                for (let i = 0; i < playersInfo.length; i++) {
                    const player = playersInfo[i];
                    const { clientId, name, icon, accent, isConnected } = player;
                    const isCopied = this.state.copiedClientId === clientId;
                    const iconName = icons[icon] || 'user';

                    rows.push(
                        <div 
                            className="room-player-card" 
                            key={'player-' + i}
                            onClick={() => this.copyPlayerJoinLink(clientId)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="player-card-profile">
                                <div className="player-card-avatar" style={{ backgroundColor: accent || '#7f8c8d' }}>
                                    <FontAwesomeIcon icon={iconName} className="player-card-avatar-icon" />
                                </div>
                                <div className="player-card-details">
                                    <span className="player-card-name">
                                        {name}
                                    </span>
                                    {isCopied ? (
                                        <span className="player-card-id" style={{ color: '#2ecc71', fontWeight: 'bold' }}>
                                            Copied Join Link!
                                        </span>
                                    ) : (
                                        <span className="player-card-id" title={clientId}>
                                            ID: {clientId.substring(0, 8)}...
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="player-card-status">
                                <span className={`status-pill ${isConnected ? 'connected' : 'disconnected'}`}>
                                    <span className="status-dot"></span>
                                    {isConnected ? 'Active' : 'Offline'}
                                </span>
                            </div>

                            <div className="player-card-actions">
                                <button 
                                    className="player-kick-btn"
                                    title="Disconnect client device"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Are you sure you want to disconnect this device?`)) {
                                            mp.disconnectClientDevice(clientId);
                                        }
                                    }}
                                >
                                    <FontAwesomeIcon icon="trash" style={{ marginRight: '6px' }} />
                                    Kick
                                </button>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="lobby-roommanagement-container">
                        <div className="lobby-roommanagement-header">
                            <h2 className="lobby-roommanagement-title">
                                <FontAwesomeIcon icon="users" style={{ marginRight: '10px', color: '#3498db' }} />
                                Connected Clients
                            </h2>
                            <div className="lobby-info-badges">
                                <div className="info-badge game-badge">
                                    <span className="info-badge-label">Game:</span>
                                    <span className="info-badge-value">{ruleName}</span>
                                </div>
                                <div className="info-badge room-badge" onClick={this.copyRoomId} title="Click to copy join link">
                                    <span className="info-badge-label">Room ID:</span>
                                    <span className="info-badge-value monospace">
                                        {this.state.copied ? 'Copied!' : roomId}
                                    </span>
                                </div>
                                <div className="info-badge count-badge">
                                    <span className="info-badge-label">Total:</span>
                                    <span className="info-badge-value">{playersInfo.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="room-players-list">
                            {rows.length > 0 ? rows : (
                                <div className="no-players-placeholder">
                                    No clients connected. Share the Room ID to allow players to join.
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
        }
    }

};

export default Shell;
