/**
 * rocksicssorspaper.ts
 */

import * as React from 'react';
import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';

import {GameRuleInterface,
        MPType,
        ViewPropsInterface} from '../../common/interfaces';

import {forEach} from '../../common/utils';

const choiceEnum = {
    0: 'Rock',
    1: 'Scissors',
    2: 'Paper',
    3: 'Lizard',
    4: 'Spock'
};

const winMap = {
    0: {},
    1: {},
    2: {},
    3: {},
    4: {}
};

winMap[0][1] = true;
winMap[1][2] = true;
winMap[2][0] = true;
winMap[0][3] = true;
winMap[3][4] = true;
winMap[4][1] = true;
winMap[1][3] = true;
winMap[3][2] = true;
winMap[2][4] = true;
winMap[4][0] = true;

export const RockScissorsPaperRule: GameRuleInterface = {

    name: 'rockscissorspaper',
    css: ['rcs.css'],

    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },

    globalData: {
        state: 'play'
    },

    playerData: {
        win: 0,
        lose: 0,
        draw: 0,
        choice: -1,
        prevChoice: -1,
        opPrevChoice: -1
    },

    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');
        const state = mp.getData('state');

        const choices = mp.getPlayersData('choice');

        const showLobby = () => {
            mp.setView(mp.hostId, 'host-lobby');
            mp.playersForEach((clientId) => {
                mp.setView(clientId, 'lobby_SetName');
            });
            return true;
        }

        const flatten = (value: any) => {
            const tr = [];
            mp.playersForEach((clientId, i) => {
                tr[i] = value[clientId];
            });
            return tr;
        }

        const gameLogic = () => {
            if (state === 'play') {
                // some player has not made his move
                mp.playersForEach((client: string, i: number) => {

                    // todo: option for variable to auto map to props
                    mp.setViewProps(client, 'opPrevChoice', mp.getPlayerData(client, 'opPrevChoice'));
                    mp.setViewProps(client, 'prevChoice', mp.getPlayerData(client, 'prevChoice'));

                    mp.setViewProps(client, 'name', mp.getPlayerData(client, 'lobby_name'));
                    mp.setViewProps(client, 'win', mp.getPlayerData(client, 'win'));
                    mp.setViewProps(client, 'lose', mp.getPlayerData(client, 'lose'));
                    mp.setViewProps(client, 'draw', mp.getPlayerData(client, 'draw'));

                    mp.setViewProps(client, 'choice', choices[i]);
                    mp.setView(client, 'chooseMove');
                });

                ['win', 'lose', 'draw'].forEach((v) => {
                    const value = mp.getPlayersData(v);
                    mp.setViewProps(mp.hostId, v, value);
                });

                mp.setView(mp.hostId, 'hostScoreTable');
            }
        }

        if (started) {
            gameLogic();
        } else {
            showLobby();
        }

        return true;
    },

    methods: {
        startGame: (mp: MPType, clientId: string) => {
            if (mp.playersCount() !== 2) {
                alert('We need exactly 2 players to play this game');
            } else {
                mp.setData('lobby_started', true)
                    .setData('state', 'play');

                mp.playersForEach((client) => {
                    mp.setPlayerData(client, 'choice', -1);
                });
            }
        },
        move: (mp: MPType, clientId: string, c) => {
            const choice = mp.getPlayerData(clientId, 'choice');

            if (choice === -1) {
                mp.setPlayerData(clientId, 'choice', c);

                const choices = mp.getPlayersData('choice');
                let done = true;
                let p1 = null;
                let p2 = null;
                let pp1 = null;
                let pp2 = null;

                mp.playersForEach((pid, i) => {
                    if (choices[i] === -1) {
                        done = false;
                    }

                    if (!p1) {
                        p1 = pid;
                        pp1 = i;
                    } else {
                        p2 = pid;
                        pp2 = i;
                    }
                });

                if (!done) {
                    return;
                }

                // tabulate results

                const inc = (pid: string, variable: any) => {
                    const value = mp.getPlayerData(pid, variable);
                    mp.setPlayerData(pid, variable, value + 1);
                }

                if (choices[pp1] === choices[pp2]) {
                    // draw
                    inc(p1, 'draw');
                    inc(p2, 'draw');
                } else if (winMap[choices[pp1]][choices[pp2]]) {
                    inc(p1, 'win');
                    inc(p2, 'lose');
                } else {
                    inc(p1, 'lose');
                    inc(p2, 'win');
                }

                // copy move into prev move and restart game
                mp.setPlayerData(p1, 'opPrevChoice', mp.getPlayerData(p2, 'choice'));
                mp.setPlayerData(p2, 'opPrevChoice', mp.getPlayerData(p1, 'choice'));
                mp.playersForEach((pid) => {
                    mp.setPlayerData(pid, 'prevChoice', mp.getPlayerData(pid, 'choice'));
                    mp.setPlayerData(pid, 'choice', -1);
                });
            } else {
                // probably a race condition. ignore
            }
        }
    },

    views: {
        'host-lobby': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;

                return mp.getPluginView('gameshell',
                                        'HostShell-Main',
                                        {
                                            'links': {
                                                'home': {
                                                    'icon': 'home',
                                                    'label': 'Home',
                                                    'view': mp.getPluginView('lobby', 'Lobby')
                                                },
                                                'clients': {
                                                    'icon': 'users',
                                                    'label': 'Players',
                                                    'view': mp.getPluginView('lobby', 'host-roommanagement')
                                                }
                                            }
                                        });
            }
        },
        'chooseMove': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return React.DOM.div(null,
                                     React.createElement(RockScissorsPaperRule.views['choices'], this.props),
                                     React.createElement(RockScissorsPaperRule.views['prevMove'], this.props),
                                     React.createElement(RockScissorsPaperRule.views['clientScoreTable'], this.props));
            }
        },
        'choices': class extends React.Component<ViewPropsInterface & {choice: number}, {}> {
            public render() {
                const mp = this.props.MP;
                const choice = this.props.choice;
                const choices = choiceEnum;

                const reactChoices = [];

                forEach(choices, (c) => {

                    if (choice === c) {
                        reactChoices.push(React.DOM.div({className: 'choice selected'},
                                                        choices[c]));
                    } else {
                        let oc = null;
                        if (choice === -1) {
                            oc = ((c) => {
                                return () => {
                                    mp.move(c);
                                };
                            })(c);
                        }
                        reactChoices.push(React.DOM.div({className: 'choice', onClick: oc},
                                                        choices[c]));
                    }
                });

                const cn = choice === -1 ? 'unselected' : 'selected';

                reactChoices.push(React.DOM.div({className: 'clearer'}));
                return React.DOM.div({id: 'choices', className: cn}, reactChoices);
            }
        },
        'prevMove': class extends React.Component<ViewPropsInterface & {prevChoice: number,
                                                                        opPrevChoice: number}, {}> {
            public render() {
                const pMove = this.props.prevChoice;
                const opMove = this.props.opPrevChoice;
                const choices = choiceEnum;

                if (pMove === -1 || opMove === -1) {
                    return React.DOM.div();
                }

                let result = '';

                if (pMove === opMove) {
                    result = 'Draw!';
                } else if (winMap[pMove][opMove]) {
                    result = 'Win!';
                } else {
                    result = 'Lose!';
                }

                return React.DOM.div(null,
                                     React.DOM.div(null, 'You: ' + choices[pMove]),
                                     React.DOM.div(null, 'Opponent: ' + choices[opMove]),
                                     React.DOM.div(null, result));
            }
        },
        'scoreHeader': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return React.DOM.tr(
                    null,
                    React.DOM.th(null, 'Player'),
                    React.DOM.th(null, 'Win'),
                    React.DOM.th(null, 'Draw'),
                    React.DOM.th(null, 'Lose'));
            }
        },
        'clientScoreTable': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return React.DOM.table(
                    null,
                    React.DOM.tbody(null,
                                    React.createElement(RockScissorsPaperRule.views['scoreHeader'], {}),
                                    React.createElement(RockScissorsPaperRule.views['score'], this.props)));
            }
        },
        'hostScoreTable': class extends React.Component<ViewPropsInterface & {lobby: any,
                                                                              win: number[],
                                                                              lose: number[],
                                                                              draw: number[]}, {}> {
            public render() {
                const mp = this.props.MP;
                const scores = [];
                let i = 0;

                for (i = 0; i < this.props.lobby.names.length; i = i + 1) {
                    scores.push(React.createElement(RockScissorsPaperRule.views['score'], {
                        name: this.props.lobby.names[i],
                        win: this.props.win[i],
                        draw: this.props.draw[i],
                        lose: this.props.lose[i]
                    }));
                }
                return mp.getPluginView('gameshell',
                                        'HostShell-Main',
                                        {
                                            'links': {
                                                'home': {
                                                    'icon': 'gamepad',
                                                    'label': 'Game',
                                                    'view': React.DOM.table(
                                                        null,
                                                        React.DOM.thead(null,
                                                                        React.createElement(
                                                                            RockScissorsPaperRule.views['scoreHeader'],
                                                                            {})),
                                                        React.DOM.tbody(null,
                                                                        scores))
                                                },
                                                'clients': {
                                                    'icon': 'users',
                                                    'label': 'Players',
                                                    'view': mp.getPluginView('lobby', 'host-roommanagement')
                                                }
                                            }
                                        });

            }
        },
        'score': class extends React.Component<ViewPropsInterface & {name: string,
                                                                     win: number,
                                                                     lose: number,
                                                                     draw: number}, {}> {
            public render() {
                return React.DOM.tr(null,
                                    React.DOM.td(null, this.props.name),
                                    React.DOM.td(null, this.props.win),
                                    React.DOM.td(null, this.props.draw),
                                    React.DOM.td(null, this.props.lose));
            }
        }
    }
};

export default RockScissorsPaperRule;
