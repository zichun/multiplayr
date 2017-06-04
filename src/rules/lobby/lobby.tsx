/**
 * lobby.tsx
 */
import * as React from 'react';
import * as Chance from 'chance';
import * as FontAwesome from 'react-fontawesome';
import './lobby.scss';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

const icons = ['car', 'id-badge', 'linode', 'thermometer-empty', 'user-circle', 'address-card-o', 'umbrella', 'quote-left',
               'id-card', 'bath', 'grav', 'microchip', 'telegram', 'imdb', 'adjust', 'area-chart', 'bank', 'battery-quarter',
               'bicycle', 'book', 'briefcase', 'bullhorn', 'calculator', 'circle', 'coffee', 'cube', 'envelope', 'feed',
               'fire-extinguisher', 'gift', 'hand-peace-o', 'hand-spock-o', 'hashtag', 'hotel', 'hourglass-3', 'legal',
               'mortar-board', 'pencil', 'phone', 'pie-chart', 'power-off', 'trash', 'binoculars', 'bug', 'cog', 'cubes',
               'female', 'flag', 'flask', 'line-chart', 'sign-language', 'sitemap', 'space-shuttle', 'tags', 'wrench',
               'ticket', 'tree', 'unlock', 'street-view', 'plug', 'money', 'male', 'fighter-jet', 'cutlery', 'bus', 'birthday-cake',
               'bed', 'beer', 'bomb', 'blind', 'cloud', 'dashboard', 'fax', 'futbol-o', 'map', 'map-signs', 'paw', 'ship',
               'etsy', 'apple', 'amazon', 'quora', 'windows', 'facebook-square', 'twitter', 'google', 'android', 'linux'];

const colors = ['#0074D9', '#7FDBFF', '#39CCCC', '#3D9970', '#2ECC40', '#01FF70', '#EEAB00', '#FF851B', '#FF4136',
                '#F012BE', '#B10DC9', '#AAAAAA'];

export const Lobby: GameRuleInterface = {

    name: 'lobby',
    css: ['lobby.css'],

    plugins: {},

    globalData: {
        started: false
    },

    playerData: {
        name: () => {
            const chance = new Chance();
            return chance.name({ nationality: 'en' });
        },
        icon: () => {
            return Math.floor(Math.random() * icons.length);
        },
        accent: () => {
            return colors[Math.floor(Math.random() * colors.length)];
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
            mp.setPlayerData(clientId, 'name', name);
        },

        setAccent: (mp: MPType, clientId: string, accent: string) => {
            mp.setPlayerData(clientId, 'accent', accent);
        },

        setIcon: (mp: MPType, clientId: string, icon: number) => {
            mp.setPlayerData(clientId, 'icon', icon);
        },

        disconnectClient: (mp: MPType, clientId: string, toDisconnectId: string) => {
            if (clientId === mp.hostId) {
                mp.removeClient(toDisconnectId);
            }
        }
    },

    views: {
        'Lobby': class extends React.Component<ViewPropsInterface & {
            names: string[],
            icons: number[],
            accents: string[]
        }, {}> {
            constructor(props: ViewPropsInterface) {
                super(props);
                this.startGame = this.startGame.bind(this);
            }

            public startGame() {
                const mp = this.props.MP;
                mp.parent.startGame();
            }

            public render() {
                const createHello = (names, icons, accents) => {
                    const tr = [];

                    for (let i = 0; i < names.length; i = i + 1) {
                        tr.push(
                            React.createElement(
                                Lobby.views['HelloMessage'],
                                {
                                    key: 'hello-' + i,
                                    name: names[i],
                                    icon: icons[i],
                                    accent: accents[i]
                                }) );
                    }

                    if (names.length === 0) {
                        tr.push(
                            React.DOM.div(
                                {
                                    className: 'waiting',
                                    key: 'waiting'
                                },
                                'Waiting for players to join'));
                    }

                    return tr;
                };

                return React.DOM.div(
                    null,
                    React.DOM.div({ id: 'lobby-playerlist' }, createHello(this.props.names, this.props.icons, this.props.accents)),
                    React.DOM.button({ onClick: this.startGame }, 'Start game')
                );
            }
        },

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
                let outerStyle = {
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
                            <FontAwesome name={ icons[this.props.icons[i]] }
                                         className='lobby-player-tag-icon' />
                        </div>
                        <div className='lobby-player-tag-name'>
                            { this.props.names[i] }
                        </div>
                    </div>
                );
            }
        },

        'avatar': class extends React.Component<ViewPropsInterface & {
            name: string,
            accent: string,
            icon: number
        }, {}> {
            public render() {
                return (
                    <div className='lobby-avatar'
                         style={{ backgroundColor: this.props.accent }}>
                        <FontAwesome name={ icons[this.props.icon] }
                                     size='4x'
                                     className='lobby-avatar-icon' />
                    </div>
                );
            }
        },

        'HelloMessage': class extends React.Component<ViewPropsInterface & {
            name: string,
            icon: number,
            accent: string
        }, {}> {
            public render() {
                const avatar = React.createElement(
                    Lobby.views['avatar'],
                    this.props);

                return (
                    <div className='lobby-player-card'>
                        { avatar }
                        <div className='lobby-name'>{ this.props.name }</div>
                    </div>
                );
            }
        },

        'SetName': class extends React.Component<ViewPropsInterface & { name: string }, { name: string }> {
            constructor(props: { name: string }) {
                super(props);
                this.state = { name: this.props.name };
                this.onChange = this.onChange.bind(this);
            }

            public onChange(e: any) {
                this.state.name = e.target.value;
                this.props.MP.setName(e.target.value);
                return true;
            }

            public render() {
                const selectIcon = React.createElement(Lobby.views['select-icon'], this.props);
                const selectAccent = React.createElement(Lobby.views['select-accent'], this.props);

                return (
                    <div className='lobby-setname-container'>
                        <input className='lobby-setname-input'
                               defaultValue={ this.state.name }
                               onChange={ this.onChange }
                               />

                        { selectIcon }
                        { selectAccent }
                    </div>
                );
            }
        },

        'select-accent': class extends React.Component<ViewPropsInterface & { accent: string }, { accent: string }> {
            constructor(props: any) {
                super(props);
                this.state = { accent: this.props.accent };
            }

            private _setAccent(accent: string) {
                this.props.MP.setAccent(accent);
                this.setState({ accent: accent });
                return true;
            }

            public render() {
                const tr = [];

                for (let i = 0; i < colors.length; i = i + 1) {
                    let className = 'lobby-select-accent';

                    if (colors[i] === this.state.accent) {
                        className += ' selected';
                    }

                    tr.push(
                        <div className={ className }
                             style={{ backgroundColor: colors[i] }}
                             onClick={ this._setAccent.bind(this, colors[i]) }
                             key={ 'accent' + i }>
                        </div>
                    );
                }

                return (
                    <div className='lobby-select-accent-container'>
                        {tr};
                        <div className='clear'>&nbsp;</div>
                    </div>
                );
            }
        },

        'select-icon': class extends React.Component<ViewPropsInterface & { icon: number, accent: string } , { icon: number }> {
            constructor(props: any) {
                super(props);
                this.state = { icon: this.props.icon };
            }

            private _setIcon(icon: number) {
                this.props.MP.setIcon(icon);
                this.setState({ icon: icon });
                return true;
            }

            public render() {
                const tr = [];

                for (let i = 0; i < icons.length; i = i + 1) {
                    let className = 'lobby-select-icon-icon';
                    let style = {};
                    if (this.state.icon === i) {
                        className += ' selected';
                        style = { 'color': this.props.accent };
                    }
                    tr.push(
                        <div className='lobby-select-icon'
                             key={ 'select-icon-' + i }
                             onClick={ this._setIcon.bind(this, i) }>

                            <FontAwesome name={ icons[i] }
                                         size='2x'
                                         className={ className }
                                         style={ style }
                                         key={ 'icon-' + icons[i] } />
                        </div>
                    );
                }

                return (
                    <div className='lobby-select-icon-container'>
                        {tr}
                        <div className='clear'>&nbsp;</div>
                    </div>
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
                    React.DOM.th(null, 'Name')
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
                    React.DOM.td(null, this.props.name)

                );
            }
        }
    }

};

export default Lobby;
