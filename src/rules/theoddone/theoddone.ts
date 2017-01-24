/**
 * theeoddone.ts
 */

import * as React from 'react';
import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

const cards = [
    ['Chicken', 'KFC'],
    ['Justin Bieber', 'Barbie Doll'],
    ['Charcoal', 'Shadow'],
    ['apple', 'microsoft'],
    ['Bush', 'Obama'],
    ['Laptop', 'Notebook'],
    ['Adult', 'Child'],
    ['Butter', 'Jam'],
    ['Break', 'Mend'],
    ['Clean', 'Dirty'],
    ['Cops', 'robbers'],
    ['Cup', 'saucer'],
    ['Dance', 'sing'],
    ['Dead', 'alive'],
    ['Doctor', 'nurse'],
    ['Dog', 'bone'],
    ['Duke', 'duchess'],
    ['Fast', 'slow'],
    ['Soda', 'Tap water'],
    ['Fish', 'chips'],
    ['Float', 'sink'],
    ['Food', 'drink'],
    ['Freeze', 'Cold'],
    ['Freeze', 'Ice'],
    ['Cold', 'Ice'],
    ['Flame', 'Candle'],
    ['Flame', 'Hot'],
    ['Singer', 'Actor'],
    ['Magician', 'Comedian'],
    ['Fresh', 'stale'],
    ['Power', 'Wisdom'],
    ['Grow', 'Big'],
    ['Horse', 'Cart'],
    ['Rap Music', 'Death Metal'],
    ['Jelly', 'Ice-cream'],
    ['King', 'President'],
    ['Knife', 'Sword'],
    ['Laugh', 'Comedy'],
    ['Letters', 'Numbers'],
    ['Moon', 'stars'],
    ['Noise', 'silence'],
    ['Open', 'close'],
    ['Paint', 'Brush'],
    ['Paper', 'pen'],
    ['Peaches', 'cream'],
    ['Pen', 'Ink'],
    ['Business', 'Work'],
    ['Magazine', 'Newspaper'],
    ['Rich', 'Spendthrift'],
    ['Poor', 'Thrifty'],
    ['Human Rights', 'Justice'],
    ['Snow', 'Ice'],
    ['Assets', 'Bank account'],
    ['Spongecake', 'Custard'],
    ['Strawberries', 'Ice-cream'],
    ['Wind', 'Blow'],
    ['Moon', 'Star'],
    ['Furry', 'Warm and Fuzzy'],
    ['Cookie', 'Biscuit'],
    ['Tea', 'Coffee'],
    ['Coffeebean', 'Cocoa'],
    ['Thunder', 'Lightning'],
    ['Together', 'apart'],
    ['Tongue', 'groove'],
    ['Toothpaste', 'toothbrush'],
    ['War', 'Riot'],
    ['Fan', 'Aircon'],
    ['Under', 'Over'],
    ['Up', 'down'],
    ['Walk', 'run'],
    ['Wet', 'Slippery'],
    ['Wine', 'Cheese'],
    ['Witchcraft', 'Magic'],
    ['Magician', 'Clown'],
    ['Musical', 'Movie'],
    ['Comedy', 'Cartoon'],
    ['moonlight', 'twilight'],
    ['table', 'chair'],
    ['lamp', 'fire'],
    ['darkness', 'void'],
    ['worship', 'celebrate'],
    ['noisy', 'exuberant'],
    ['drummer', 'guitarist'],
    ['kettle', 'pot'],
    ['watch', 'clock'],
    ['dumbbell', 'bench press machine'],
    ['tail', 'butt'],
    ['hopeful', 'genuine'],
    ['genuine', 'hopeful'],
    ['last', 'first'],
    ['coat', 'sweater'],
    ['dry', 'heated'],
    ['stand', 'sit'],
    ['smooth', 'slippery'],
    ['electric', 'analog'],
    ['bag', 'purse'],
    ['cushion', 'bolster'],
    ['bedsheet', 'pillowcase'],
    ['clean', 'dirty'],
    ['bridge', 'poker'],
    ['crazy', 'calm'],
    ['joy', 'sadness'],
    ['rude', 'clueless'],
    ['old', 'experienced'],
    ['towel', 'toilet paper'],
    ['moisture', 'dew'],
    ['speed', 'dexterity'],
    ['reflection', 'refraction'],
    ['polka dot', 'hearts'],
    ['guitar', 'violin'],
    ['quarter', 'dime'],
    ['chilli', 'wasabi'],
    ['movement', 'stationary'],
    ['dull', 'sharp'],
    ['control', 'treatment'],
    ['tie', 'bow'],
    ['will', 'force'],
    ['twilight', 'dusk'],
    ['chair', 'bench'],
    ['fire', 'flame'],
    ['void', 'blank'],
    ['celebrate', 'parade'],
    ['exuberant', 'happy'],
    ['guitarist', 'violinist'],
    ['pot', 'pan'],
    ['clock', 'watch'],
    ['bench press machine', 'treadmill'],
    ['butt', 'chair'],
    ['genuine', 'real'],
    ['hopeful', 'wishful'],
    ['first', 'top'],
    ['sweater', 'jacket'],
    ['heated', 'warmed'],
    ['sit', 'stand'],
    ['slippery', 'smooth'],
    ['analog', 'digital'],
    ['purse', 'wallet'],
    ['bolster', 'pillow'],
    ['pillowcase', 'blanket'],
    ['dirty', 'filthy'],
    ['poker', 'bridge'],
    ['calm', 'peaceful'],
    ['sadness', 'despair'],
    ['clueless', 'lost'],
    ['experienced', 'professional'],
    ['toilet paper', 'toilet bowl'],
    ['dew', 'mist'],
    ['dexterity', 'ambidextrous'],
    ['refraction', 'reflection'],
    ['hearts', 'spades'],
    ['violin', 'guitar'],
    ['dime', 'quarter'],
    ['wasabi', 'mustard'],
    ['stationary', 'still'],
    ['sharp', 'pointed'],
    ['treatment', 'care'],
    ['bow', 'kneel'],
    ['force', 'coerce'],
    ['dusk', 'dirt'],
    ['bench', 'benchmark'],
    ['flame', 'fire'],
    ['blank', 'space'],
    ['parade', 'celebration'],
    ['happy', 'joy'],
    ['violinist', 'yoyo ma'],
    ['pan', 'pot'],
    ['watch', 'clock'],
    ['treadmill', 'kettle bell'],
    ['chair', 'desk'],
    ['real', 'fake'],
    ['wishful', 'hopeful'],
    ['top', 'first'],
    ['jacket', 'vest'],
    ['warmed', 'chilled'],
    ['stand', 'walk'],
    ['smooth', 'smoothy'],
    ['digital', 'manual'],
    ['wallet', 'bank'],
    ['pillow', 'pillow case'],
    ['blanket', 'pillow'],
    ['filthy', 'wealthy'],
    ['bridge', 'connection'],
    ['peaceful', 'quiet'],
    ['despair', 'desperate'],
    ['lost', 'found'],
    ['professional', 'skillful'],
    ['toilet bowl', 'basin'],
    ['mist', 'fog'],
    ['ambidextrous', 'right-handed'],
    ['reflection', 'water'],
    ['spades', 'hearts'],
    ['guitar', 'strings'],
    ['quarter', 'penny'],
    ['mustard', 'yellow'],
    ['still', 'quiet'],
    ['pointed', 'round'],
    ['care', 'detergent'],
    ['kneel', 'crawl'],
    ['coerce', 'persuade']
];

export const TheOddOneRule: GameRuleInterface = {

    name: 'theoddone',
    css: ['theoddone.css'],

    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },

    globalData: {
        state: 'play',
        turn: 0,
        currentCard: 0
    },

    playerData: {
        card: 0,
        score: 0,
        isDead: false,
        isOdd: false,
        vote: -1
    },

    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');
        const state = mp.getData('state');

        const showLobby = () => {
            mp.setView(mp.clientId, 'host-lobby');

            mp.playersForEach((clientId) => {
                mp.setView(clientId, 'lobby_SetName');
            });

            return true;
        }

        const gameLogic = () => {
            const currentCard = mp.getData('currentCard');
            mp.setViewProps(mp.clientId, 'currentCard', currentCard);

            mp.playersForEach((client, i) => {
                const playerCard = mp.getPlayerData(client, 'card');
                const word = cards[currentCard][playerCard];

                mp.setViewProps(client, 'score', mp.getPlayerData(client, 'score'));
                mp.setViewProps(client, 'vote', mp.getPlayerData(client, 'vote'));
                mp.setViewProps(client, 'dead', mp.getDead());
                mp.setViewProps(client, 'word', word);

                mp.setView(client, 'client-voting');
            });

            if (state === 'play') {

                mp.setViewProps(mp.clientId, 'votes', mp.getVotes());
                mp.setView(mp.clientId, 'host-voteTable');

            } else if (state === 'gameEnd') {

                mp.setViewProps(mp.clientId,
                                'playerSummary',
                                mp.getPlayersData(['score', 'isDead', 'isOdd', 'card']));

                mp.setView(mp.clientId, 'host-summary');

            }

            return true;
        }

        if (started) {
            return gameLogic();
        } else {
            return showLobby();
        }
    },

    methods: {
        startGame: (mp) => {
            if (mp.playersCount() < 3) {
                alert('We need at least 3 players to play this game');
            } else {
                mp.setData('lobby_started', true)
                    .setData('state', 'play');

                mp.newGame();
            }
        },
        vote: (mp, clientId, c) => {
            mp.setPlayerData(clientId, 'vote', c);
        },
        commitVote: (mp, clientId) => {
            const  votes = mp.getVotes();
            let major = 0;

            for (let i = 0; i < mp.playersCount(); i = i + 1) {
                if (votes[i] > votes[major]) {
                    major = i;
                }
            }

            mp.killPlayer(major);
        },
        leftAlive: (mp) => {
            let  cnt = 0;
            mp.playersForEach((pid, i) => {
                cnt += (mp.getPlayerData(pid, 'isDead') ? 0 : 1);
            });
            return cnt;
        },
        killPlayer: (mp, clientId, toKill) => {
            let leftAlive = 0;
            let gameEnd = false;
            let oddOne = 0;
            let score = 0;

            mp.playersForEach((pid, i) => {
                const isOdd = mp.getPlayerData(pid, 'isOdd');

                if (i === toKill) {
                    mp.setPlayerData(pid, 'isDead', true);

                    if (isOdd) {
                        gameEnd = true;
                    }
                }

                const isDead = mp.getPlayerData(pid, 'isDead');

                if (isOdd) {
                    oddOne = pid;
                }

                if (isDead && !isOdd) {
                    score = score + 1;
                }

                leftAlive += isDead ? 0 : 1;

                mp.setPlayerData(pid, 'vote', -1);
            });

            if (leftAlive <= 2) {
                gameEnd = true;
            }

            if (gameEnd === true) {
                mp.setData('state', 'gameEnd');
                mp.setPlayerData(oddOne, 'score', mp.getPlayerData(oddOne, 'score') + score);
            }

            const otherScore = mp.playersCount() - 2 - score;
            mp.playersForEach((pid, i) => {
                const isOdd = mp.getPlayerData(pid, 'isOdd');
                if (!isOdd) {
                    mp.setPlayerData(pid, 'score', mp.getPlayerData(pid, 'score') + otherScore);
                }
            });
        },
        getDead: (mp) => {
            const dead = [];
            mp.playersForEach((pid, i) => {
                dead[i] = mp.getPlayerData(pid, 'isDead');
            });
            return dead;
        },
        getVotes: (mp) => {
            let i = 0;

            const votesMap = mp.getPlayersData('vote');
            const votes = [];

            for (i = 0; i < mp.playersCount(); i = i + 1) {
                votes[i] = 0;
            }

            for (i = 0; i < mp.playersCount(); i = i + 1) {
                votes[votesMap[i]]++;
            }

            return votes;
        },
        newGame: (mp) => {
            const playersCount = mp.playersCount();
            const oddOne = Math.floor(Math.random() * playersCount);
            const cardSel = Math.floor(Math.random() * cards.length);
            const oddCard = Math.floor(Math.random() * 2);

            mp.playersForEach((pid, i) => {
                if (i === oddOne) {
                    mp.setPlayerData(pid, 'card', oddCard);
                    mp.setPlayerData(pid, 'isOdd', true);
                } else {
                    mp.setPlayerData(pid, 'card', 1 - oddCard);
                    mp.setPlayerData(pid, 'isOdd', false);
                }
                mp.setPlayerData(pid, 'vote', -1);
                mp.setPlayerData(pid, 'isDead', false);
            });

            mp.setData('currentCard', cardSel);
            mp.setData('state', 'play');
        },
        getPlayerSummary: (mp) => {
            return false;
        }
    },

    views: {
        //
        // Host Rules
        //

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

        'host-voteTable': class extends React.Component<ViewPropsInterface & {
            votes: any,
            lobby: any
        }, {}> {
            constructor(props: ViewPropsInterface) {
                super(props);
                this.commitVote = this.commitVote.bind(this);
            }
            public render() {
                const mp = this.props.MP;
                const scores = [];
                const votes = this.props.votes;
                let major = -1;
                let lsofar = 0;
                let submitButton;
                let i;

                if (votes[0] > 0) {
                    major = 0;
                }

                for (i = 1; i < this.props.lobby.names.length; i = i + 1) {
                    if (votes[i] > votes[lsofar]) {
                        lsofar = i;
                        major = i;
                    } else if (votes[i] === votes[lsofar]) {
                        major = -1;
                    }
                }

                for (i = 0; i < this.props.lobby.names.length; i = i + 1) {
                    const cn = (major === i ? 'major' : '');
                    scores.push(React.DOM.li({className: cn}, this.props.lobby.names[i] + ' - Votes: ' + votes[i]));
                }

                if (major === -1) {
                    submitButton = null;
                } else {
                    submitButton = React.DOM.button({id: 'theoddone-vote-submit', onClick: this.commitVote }, 'Commit!');
                }

                return mp.getPluginView('gameshell',
                                        'HostShell-Main',
                                        {
                                            'links': {
                                                'home': {
                                                    'icon': 'gamepad',
                                                    'label': 'Game',
                                                    'view': React.DOM.div(null,
                                                                          React.DOM.ol({id: 'theoddone-votetable'}, scores),
                                                                          submitButton)
                                                },
                                                'clients': {
                                                    'icon': 'users',
                                                    'label': 'Players',
                                                    'view': mp.getPluginView('lobby', 'host-roommanagement')
                                                }
                                            }
                                        });
            }

            public commitVote() {
                const mp = this.props.MP;
                mp.commitVote();
            }
        },

        'host-summary': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;
                const button = React.DOM.button({onClick: function() { mp.newGame(); } },
                                                'New Game');
                return mp.getPluginView('gameshell',
                                        'HostShell-Main',
                                        {
                                            'links': {
                                                'home': {
                                                    'icon': 'gamepad',
                                                    'label': 'Game',
                                                    'view': React.DOM.div(null,
                                                                          React.createElement(TheOddOneRule.views['host-summaryTable'],
                                                                                              this.props),
                                                                          button)
                                                },
                                                'clients': {
                                                    'icon': 'users',
                                                    'label': 'Players',
                                                    'view': mp.getPluginView('lobby', 'host-roommanagement')
                                                }
                                            }
                                        });
            }
            public newGame() {
                const mp = this.props.MP;
                mp.newGame();
            }
        },

        'host-summaryTable': class extends React.Component<ViewPropsInterface & {
            currentCard: any,
            lobby: any,
            playerSummary: any
        }, {}> {
            public render() {
                const scores = [];
                const currentCard = this.props.currentCard;
                let i = 0;

                for (i = 0; i < this.props.lobby.names.length; i = i + 1) {
                    const word = cards[currentCard][this.props.playerSummary[i].card];
                    scores.push(React.createElement(TheOddOneRule.views['host-summaryTable-scoreRow'], {
                        name: this.props.lobby.names[i],
                        word: word,
                        score: this.props.playerSummary[i].score,
                        isOdd: this.props.playerSummary[i].isOdd,
                        isDead: this.props.playerSummary[i].isDead
                    }));
                }

                return React.DOM.table({id: 'theoddone-summary-table', cellSpacing: '1px'},
                                       React.createElement(TheOddOneRule.views['host-summaryTable-scoreHeader'], {}),
                                       scores);
            }
        },

        'host-summaryTable-scoreHeader': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return React.DOM.tr(
                    null,
                    React.DOM.th(null, 'Player'),
                    React.DOM.th(null, 'Word'),
                    React.DOM.th(null, 'Score')
                );
            }
        },

        'host-summaryTable-scoreRow': class extends React.Component<ViewPropsInterface & {
            isOdd: boolean,
            isDead: boolean,
            name: string,
            word: string,
            score: string
        }, {}> {
            public render() {
                const cn = [];
                if (this.props.isOdd) {
                    cn.push('odd');
                }
                if (this.props.isDead) {
                    cn.push('dead');
                }
                return React.DOM.tr({className: cn.join(' ')},
                                    React.DOM.td({className: 'name'}, this.props.name),
                                    React.DOM.td(null, this.props.word),
                                    React.DOM.td(null, this.props.score));
            }
        },

        //
        // Client Views
        //

        'client-voting': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return React.DOM.div({id: 'theoddone-voting'},
                                     React.createElement(TheOddOneRule.views['client-word'], this.props),
                                     React.createElement(TheOddOneRule.views['client-voting-choices'], this.props));
            }
        },

        'client-word': class extends React.Component<ViewPropsInterface & { word: any }, {}> {
            public render() {
                const word = this.props.word;
                return React.DOM.div({id: 'theoddone-word'}, word);
            }
        },

        'client-voting-choices': class extends React.Component<ViewPropsInterface & {
            vote: any,
            dead: any,
            lobby: any
        }, {}> {
            public render() {
                const mp = this.props.MP;
                const reactChoices = [];
                const vote = this.props.vote;
                const dead = this.props.dead;
                let i = 0;

                for (i = 0; i < this.props.lobby.names.length; i = i + 1) {
                    const player = this.props.lobby.names[i];

                    if (vote === i) {
                        reactChoices.push(React.DOM.div({className: 'choice selected'},
                                                        player));
                    } else {
                        let oc = null;

                        if (dead[i] === false) {
                            oc = ((i) => {
                                return function() {
                                    mp.vote(i);
                                };
                            })(i);
                        }

                        const deadClass = dead[i] ? ' dead' : '';

                        reactChoices.push(React.DOM.div({className: 'choice' + deadClass, onClick: oc},
                                                        player));
                    }
                }

                const cn = vote === -1 ? 'unselected' : 'selected';

                reactChoices.push(React.DOM.div({className: 'clearer'}));
                return React.DOM.div({id: 'choices', className: cn}, reactChoices);
            }
        }
    }
};