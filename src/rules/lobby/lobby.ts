/**
 * lobby.ts
 */
import * as React from 'react';

import {GameRuleInterface,
        MPType,
        ViewPropsInterface} from '../../common/interfaces';

export const Lobby: GameRuleInterface = {

    name: 'lobby',
    css: ['lobby.css'],

    plugins: {},

    globalData: {
        started: false
    },

    playerData: {
        name: 'player'
    },

    onDataChange: (mp: MPType) => {
        const names = mp.getPlayersData('name');
        const connected = mp.getPlayersData('__isConnected');
        const orderedNames = [];
        const clientIds = [];
        const playersConnection = [];

        mp.playersForEach((client, i) => {
            clientIds.push(client);
            orderedNames.push(names[i]);
            playersConnection.push(connected[i]);
        });

        mp.playersForEach((client, ind) => {
            mp.setViewProps(client, 'clientId', client);
            mp.setViewProps(client, 'name', names[ind]);
            mp.setViewProps(client, 'playerNum', ind);
            mp.setViewProps(client, 'playerCount', mp.playersCount());
            mp.setViewProps(client, 'names', orderedNames);
        });

        mp.setViewProps(mp.hostId, 'clientIds', clientIds);
        mp.setViewProps(mp.hostId, 'names', orderedNames);
        mp.setViewProps(mp.hostId, 'playerCount', mp.playersCount());
        mp.setViewProps(mp.hostId, 'playersConnection', playersConnection);

        return false;
    },

    methods: {
        setName: (mp: MPType, clientId: string, name: string) => {
            mp.setPlayerData(clientId, 'name', name);
        },

        disconnectClient: (mp: MPType, clientId: string, toDisconnectId: string) => {
            if (clientId === mp.hostId) {
                mp.removeClient(toDisconnectId);
            }
        }
    },

    views: {
        'Lobby': class extends React.Component<ViewPropsInterface & {names: string[]}, {}> {
            constructor(props: ViewPropsInterface) {
                super(props);
                this.startGame = this.startGame.bind(this);
            }
            public startGame() {
                const mp = this.props.MP;
                mp.parent.startGame();
            }
            public render() {
                const createHello = (names) => {
                    const tr = [];

                    for (let i = 0; i < names.length; i = i + 1) {
                        tr.push( React.createElement(Lobby.views['HelloMessage'], {name: names[i]}) );
                    }

                    if (names.length === 0) {
                        tr.push( React.DOM.div({className: 'waiting'},
                                               'Waiting for players to join'));
                    }

                    return tr;
                }
                return React.DOM.div(
                    null,
                    React.DOM.div({id: 'lobby-playerlist'}, createHello(this.props.names)),
                    React.DOM.button({onClick: this.startGame}, 'Start game')
                );
            }
        },

        HelloMessage: class extends React.Component<ViewPropsInterface & {name: string}, {}> {
            public render() {
                return React.DOM.div(null,
                                     'Hello',
                                     React.DOM.span({className: 'lobby-name'},
                                                    this.props.name));
            }
        },
        SetName: class extends React.Component<ViewPropsInterface & {name: string}, {name: string}> {
            constructor(props: {name: string}) {
                super(props);
                this.state = {name: props.name};
                this.onChange = this.onChange.bind(this);
            }

            public onChange(e: any) {
                this.state.name = e.target.value;
                this.props.MP.setName(e.target.value);
                return true;
            }

            public render() {
                return React.DOM.div(
                    {id: 'setname-container'},
                    React.DOM.div({id: 'setname-header'}, 'Name'),
                    React.DOM.input( {id: 'setname-input', value: this.state.name, onChange: this.onChange } )
                );
            }
        },

        //
        // Views to allow host to manage players in the room
        //
        'host-roommanagement': class extends React.Component<ViewPropsInterface, {}> {
            public render() {

                return React.DOM.table(
                    {id: 'lobby-roommanagement'},
                    React.createElement(Lobby.views['host-roommanagement-header'], {}),
                    React.createElement(Lobby.views['host-roommanagement-body'], this.props)
                );
            }
        },

        'host-roommanagement-header': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return React.DOM.tr(
                    null,
                    React.DOM.th(null, ' '),
                    React.DOM.th(null, 'Client-Id'),
                    React.DOM.th(null, 'Name'),
                    React.DOM.th(null, ' ')
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
                        isConnected: this.props.playersConnection[i]
                    }));
                }
                return React.DOM.tbody(null,
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
                return React.DOM.tr(
                    null,
                    React.DOM.td(null,
                                 React.DOM.div({
                                     className: this.props.isConnected ? 'lobby-connected' : 'lobby-disconnected'
                                 }, '')),
                    React.DOM.td(null, this.props.clientId),
                    React.DOM.td(null, this.props.name),
                    React.DOM.td(null,
                                 React.DOM.button({
                                     onClick: this.disconnect
                                 }, 'Disconnect'))

                );
            }
        }
    }

};

export default Lobby;
