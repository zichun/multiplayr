/**
 * lobby.tsx
 */
import * as React from 'react';
import * as Chance from 'chance';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { icons, LobbyView, LobbySetNameView, LobbySelectIconView, LobbySelectAccentView, LobbyAvatarView, LobbyHelloView, LobbyHostNameView } from './LobbyView';
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
        'LobbyWithHostName': LobbyHostNameView,
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
                    <div className={ className }
                         style={ outerStyle }>
                        <div className='lobby-player-tag-avatar'
                             style={ style }>
                            <FontAwesomeIcon icon={ icons[this.props.icons[i]] }
                                         className='lobby-player-tag-icon' />
                        </div>
                        <div className='lobby-player-tag-name'>
                            { this.props.names[i] }
                        </div>
                    </div>
                );
            }
        },

        'avatar': LobbyAvatarView,
        'HelloMessage': LobbyHelloView,

        //
        // Views to allow host to manage players in the room
        //
        'host-roommanagement': class extends React.Component<ViewPropsInterface, {}> {
            public render() {

                return React.createElement(
                    'table',
                    {id: 'lobby-roommanagement'},
                    React.createElement(Lobby.views['host-roommanagement-header'], {}),
                    React.createElement(Lobby.views['host-roommanagement-body'], this.props)
                );
            }
        },

        'host-roommanagement-header': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return React.createElement(
                    'tr',
                    null,
                    React.createElement('th', null, ' '),
                    React.createElement('th', null, 'Client-Id'),
                    React.createElement('th', null, 'Name')
                );
            }
        },

        'host-roommanagement-body': class extends React.Component<ViewPropsInterface & {names: string[],
                                                                                        clientIds: string[],
                                                                                        playersConnection: boolean[]}, {}> {
            public render() {
                const tr = [];
                for (let i = 0; i < this.props.names.length; i = i + 1) {
                    tr.push(React.createElement(Lobby.views['host-roommanagement-body-row'], {
                        MP: this.props.MP,
                        clientId: this.props.clientIds[i],
                        name: this.props.names[i],
                        isConnected: this.props.playersConnection[i],
                        key: 'player' + i
                    }));
                }
                return React.createElement('tbody',
                                           null,
                                           tr);
            }
        },

        'host-roommanagement-body-row': class extends React.Component<ViewPropsInterface & {clientId: string,
                                                                                            isConnected: boolean,
                                                                                            name: string}, {}> {
            public disconnect() {
                this.props.MP.disconnectClient(this.props.clientId);
                return true;
            }

            public render() {
                return React.createElement(
                    'tr',
                    null,
                    React.createElement(
                        'td',
                        null,
                        React.createElement(
                            'div',
                            {
                                className: this.props.isConnected ? 'lobby-connected' : 'lobby-disconnected'
                            },
                            '')),
                    React.createElement('td', null, this.props.clientId),
                    React.createElement('td', null, this.props.name)

                );
            }
        }
    }

};

export default Lobby;
