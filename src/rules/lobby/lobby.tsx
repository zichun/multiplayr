/**
 * lobby.tsx
 */
import * as React from 'react';
import * as Chance from 'chance';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { icons, LobbyView, LobbySetNameView, LobbySelectIconView, LobbySelectAccentView, LobbyAvatarView, LobbyHelloView, LobbyHostNameView, LobbyNameView } from './LobbyView';
import './lobby.scss';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

interface LobbyViewInterface extends ViewPropsInterface {
    names: string[],
    icons: number[],
    accents: string[]
}
interface LobbySetNameViewInterface extends ViewPropsInterface {
    name: string,
    colors: string[]
}

export const Lobby: GameRuleInterface = {

    name: 'lobby',

    plugins: {},

    globalData: {
        started: false,
        name: "Host",
        icon: () => {
            return Math.floor(Math.random() * icons.length);
        },
        accent: () => {
            return '';
        }
    },

    playerData: {
        name: ""
        // () => {
        //    const chance = new Chance();
        //    return chance.name({ nationality: 'en' });
        //}
        ,
        icon: () => {
            return Math.floor(Math.random() * icons.length);
        },
        accent: () => {
            return '';
        }
    },

    onDataChange: (mp: MPType) => {
        const names = mp.getPlayersData('name');
        const icons = mp.getPlayersData('icon');
        const accents = mp.getPlayersData('accent');
        const connected = mp.getPlayersData('__isConnected');
        const orderedNames = [];
        const orderedIcons = [];
        const orderedAccents = [];
        const clientIds = [];
        const playersConnection = [];

        const showHost = mp.parent && mp.parent.hostAsPlayer;

        mp.playersForEach((client, i) => {
            clientIds.push(client);
            orderedNames.push(names[i]);
            orderedIcons.push(icons[i]);
            orderedAccents.push(accents[i]);
            playersConnection.push(connected[i]);
        });
        clientIds.push(mp.hostId);
        orderedNames.push(mp.getData('name'));
        orderedIcons.push(mp.getData('icon'));
        orderedAccents.push(mp.getData('accent'));

        mp.playersForEach((client, ind) => {
            mp.setViewProps(client, 'clientId', client);
            mp.setViewProps(client, 'name', names[ind]);
            mp.setViewProps(client, 'icon', icons[ind]);
            mp.setViewProps(client, 'accent', accents[ind]);

            mp.setViewProps(client, 'playerNum', ind);
            mp.setViewProps(client, 'playerCount', mp.playersCount());
            mp.setViewProps(client, 'clientIds', clientIds);
            mp.setViewProps(client, 'names', orderedNames);
            mp.setViewProps(client, 'icons', orderedIcons);
            mp.setViewProps(client, 'accents', orderedAccents);
            mp.setViewProps(client, 'showHost', showHost);
        });

        mp.setViewProps(mp.hostId, 'name', mp.getData('name'));
        mp.setViewProps(mp.hostId, 'icon', mp.getData('icon'));
        mp.setViewProps(mp.hostId, 'accent', mp.getData('accent'));

        mp.setViewProps(mp.hostId, 'clientIds', clientIds);
        mp.setViewProps(mp.hostId, 'names', orderedNames);
        mp.setViewProps(mp.hostId, 'icons', orderedIcons);
        mp.setViewProps(mp.hostId, 'accents', orderedAccents);
        mp.setViewProps(mp.hostId, 'playerCount', mp.playersCount());
        mp.setViewProps(mp.hostId, 'playersConnection', playersConnection);
        mp.setViewProps(mp.hostId, 'showHost', showHost);

        return false;
    },

    methods: {
        setName: (mp: MPType, clientId: string, name: string) => {
            if (clientId === mp.hostId) {
                mp.setData('name', name);
            } else {
                mp.setPlayerData(clientId, 'name', name);
            }
        },

        setAccent: (mp: MPType, clientId: string, accent: string) => {
            if (clientId === mp.hostId) {
                mp.setData('accent', accent);
            } else {
                mp.setPlayerData(clientId, 'accent', accent);
            }
        },

        setIcon: (mp: MPType, clientId: string, icon: number) => {
            if (clientId === mp.hostId) {
                mp.setData('icon', icon);
            } else {
                mp.setPlayerData(clientId, 'icon', icon);
            }
        },

        disconnectClient: (mp: MPType, clientId: string, toDisconnectId: string) => {
            if (clientId === mp.hostId) {
                mp.removeClient(toDisconnectId);
            }
        }
    },

    views: {
        'Lobby': LobbyView,
        'SetNameWithLobby': LobbyHostNameView,
        'SetName': LobbySetNameView,
        'select-accent': LobbySelectAccentView,
        'select-icon': LobbySelectIconView,

        'player-tag': class extends React.Component<ViewPropsInterface & {
            clientId: string,
            clientIds: string[],
            clientIndex: number,
            names: string[],
            accents: string[],
            icons: number[],
            size?: string,
            invertColors?: boolean,
            className?: string,
            border?: boolean
        }, {}> {
            public render() {
                let i = undefined;
                const invertColors = this.props.invertColors;

                if (this.props.clientIndex !== undefined) {
                    i = this.props.clientIndex;
                } else if (this.props.clientId !== undefined) {

                    for (i = 0; i < this.props.clientIds.length; i = i + 1) {
                        if (this.props.clientId === this.props.clientIds[i]) {
                            break;
                        }
                    }
                }

                if (i === this.props.clientIds.length || i === undefined) {
                    return (<div />);
                }

                let style = { color: this.props.accents[i] };
                const outerStyle = {
                    borderColor: this.props.accents[i],
                    backgroundColor: 'transparent'
                };

                let className = 'lobby-player-tag';

                if (invertColors) {
                    style = { color: 'white' };
                    outerStyle['backgroundColor'] = this.props.accents[i];
                    className += ' invert';
                }

                if (this.props.size) {
                    className += ' lobby-player-tag-' + this.props.size;
                }

                if (this.props.className) {
                    className += ' ' + this.props.className;
                }

                if (this.props.border === false) {
                    className += ' ' + 'no-border';
                }

                return (
                    <div className={className}
                        style={outerStyle}>
                        <div className='lobby-player-tag-avatar'
                            style={style}>
                            <FontAwesomeIcon icon={icons[this.props.icons[i]]}
                                className='lobby-player-tag-icon' />
                        </div>
                        <div className='lobby-player-tag-name'>
                            {this.props.names[i]}
                        </div>
                    </div>
                );
            }
        },

        'avatar': LobbyAvatarView,
        'player-name': LobbyNameView,
        'HelloMessage': LobbyHelloView,

        //
        // Views to allow host to manage players in the room
        //
        'host-roommanagement': class extends React.Component<ViewPropsInterface & {
            names: string[],
            clientIds: string[],
            icons: number[],
            accents: string[],
            playersConnection: boolean[],
            playerCount: number
        }, { copied: boolean }> {
            constructor(props: any) {
                super(props);
                this.state = { copied: false };
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
                const roomId = mp.roomId;
                const rawRuleName = mp.parent && mp.parent.ruleName ? mp.parent.ruleName : (localStorage.getItem('ruleName') || sessionStorage.getItem('ruleName') || 'Game');

                const ruleDisplayName = (name: string): string => {
                    if (!name) return 'Game Lobby';
                    if (name.toLowerCase() === 'catchsketch') return 'Catch Sketch';
                    if (name.toLowerCase() === 'theoddone') return 'The Odd One';
                    if (name.toLowerCase() === 'tictactoepoker') return 'Tic Tac Toe Poker';
                    if (name.toLowerCase() === 'minesweeperflags') return 'Minesweeper Flags';
                    return name.charAt(0).toUpperCase() + name.slice(1);
                };

                const gameName = ruleDisplayName(rawRuleName);

                const rows = [];
                for (let i = 0; i < this.props.names.length; i++) {
                    const clientId = this.props.clientIds[i];
                    const name = this.props.names[i];
                    const iconIndex = this.props.icons[i] ?? 0;
                    const accent = this.props.accents[i] || '#888';
                    const isHost = clientId === mp.hostId;
                    const isConnected = isHost ? true : this.props.playersConnection[i];

                    rows.push(
                        <div className={`room-player-card ${isHost ? 'is-host' : ''}`} key={'player-' + i}>
                            <div className="player-card-profile">
                                <div className="player-card-avatar" style={{ backgroundColor: accent }}>
                                    <FontAwesomeIcon icon={icons[iconIndex]} className="player-card-avatar-icon" />
                                </div>
                                <div className="player-card-details">
                                    <span className="player-card-name">
                                        {name}
                                        {isHost && <span className="player-card-badge host">Host</span>}
                                    </span>
                                    <span className="player-card-id" title={clientId}>
                                        ID: {clientId.substring(0, 8)}...
                                    </span>
                                </div>
                            </div>

                            <div className="player-card-status">
                                <span className={`status-pill ${isConnected ? 'connected' : 'disconnected'}`}>
                                    <span className="status-dot"></span>
                                    {isConnected ? 'Active' : 'Offline'}
                                </span>
                            </div>

                            <div className="player-card-actions">
                                {!isHost ? (
                                    <button
                                        className="player-kick-btn"
                                        title="Kick player from room"
                                        onClick={() => {
                                            if (confirm(`Are you sure you want to kick ${name} from this lobby?`)) {
                                                mp.disconnectClient(clientId);
                                            }
                                        }}
                                    >
                                        <FontAwesomeIcon icon="trash" style={{ marginRight: '6px' }} />
                                        Kick
                                    </button>
                                ) : (
                                    <span className="player-host-lock" title="You cannot kick the host">
                                        <FontAwesomeIcon icon="unlock" style={{ opacity: 0.5 }} />
                                    </span>
                                )}
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
                                    <span className="info-badge-label">Lobby:</span>
                                    <span className="info-badge-value">{gameName}</span>
                                </div>
                                <div className="info-badge room-badge" onClick={this.copyRoomId} title="Click to copy join link">
                                    <span className="info-badge-label">Room ID:</span>
                                    <span className="info-badge-value monospace">
                                        {this.state.copied ? 'Copied!' : roomId}
                                    </span>
                                </div>
                                <div className="info-badge count-badge">
                                    <span className="info-badge-label">Connected:</span>
                                    <span className="info-badge-value">{this.props.names.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="room-players-list">
                            {rows}
                        </div>
                    </div>
                );
            }
        }
    }

};

export default Lobby;
