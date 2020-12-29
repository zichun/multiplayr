/**
 * theeoddone.ts
 */

import * as React from 'react';
import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './theoddone.scss';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

import {
    WordPairs
} from './wordpair';

const cards = WordPairs;

interface TheOddOneHostVoteTableViewInterface extends ViewPropsInterface {
    votes: any,
    lobby: any,
    startPlayer: any
}

export const TheOddOneRule: GameRuleInterface = {

    name: 'theoddone',
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },

    globalData: {
        'state': 'play',
        'turn': 0,
        'currentCard': 0,
        'gameType': 0,
        'startPlayer': 0
    },

    playerData: {
        'card': 0,
        'score': 0,
        'isDead': false,
        'isOdd': false,
        'vote': -1
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
            const gameType = mp.getData('gameType');
            mp.setViewProps(mp.clientId, 'currentCard', currentCard);
            mp.setViewProps(mp.clientId, 'startPlayer', mp.getData('startPlayer'));

            mp.playersForEach((client, i) => {
                const playerCard = mp.getPlayerData(client, 'card');
                const word = cards[currentCard][playerCard];

                mp.setViewProps(client, 'score', mp.getPlayerData(client, 'score'));
                mp.setViewProps(client, 'vote', mp.getPlayerData(client, 'vote'));
                mp.setViewProps(client, 'dead', mp.getDead());
                mp.setViewProps(client, 'word', word);
                mp.setViewProps(client, 'gameType', gameType);
                if (gameType === 1)
                {
                    mp.setViewProps(client, 'isOdd', mp.getPlayerData(client, 'isOdd'));
                }

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
        newGame: (mp, clientId, gameType) => {

            if (typeof gameType === 'undefined')
            {
                gameType = mp.getData('gameType');
            }
            else
            {
                mp.setData('gameType', gameType);
            }

            const playersCount = mp.playersCount();
            const oddOne = Math.floor(Math.random() * playersCount);
            const cardSel = Math.floor(Math.random() * cards.length);
            const oddCard = Math.floor(Math.random() * 2);
            let startPlayer = Math.floor(Math.random() * playersCount);
            let count = (gameType === 0 ? 1 : 2);

            while (count > 0 && startPlayer === oddOne)
            {
                startPlayer = Math.floor(Math.random() * playersCount);
                --count;
            }

            mp.playersForEach((pid, i) => {
                    mp.setPlayerData(pid, 'vote', -1);
                mp.setPlayerData(pid, 'isDead', false);
            });

            if (gameType === 0)
            {
                mp.playersForEach((pid, i) => {
                    if (i === oddOne) {
                        mp.setPlayerData(pid, 'card', oddCard);
                        mp.setPlayerData(pid, 'isOdd', true);
                    } else {
                        mp.setPlayerData(pid, 'card', 1 - oddCard);
                        mp.setPlayerData(pid, 'isOdd', false);
                    }
                });
            }
            else
            {
                mp.playersForEach((pid, i) => {
                    mp.setPlayerData(pid, 'card', oddCard);
                    if (i === oddOne) {
                        mp.setPlayerData(pid, 'isOdd', true);
                    } else {
                        mp.setPlayerData(pid, 'isOdd', false);
                    }
                });

                const switchCount = Math.floor((playersCount - 1) / 2);
                const toSwitch = [];
                for (let i = 0; i < switchCount; i = i + 1)
                {
                    let candidate = -1;
                    do {
                        candidate = Math.floor(Math.random() * playersCount);
                    } while(candidate === oddOne && toSwitch.indexOf(candidate) === -1);
                    toSwitch.push(candidate);
                }
                mp.playersForEach((pid, i) => {
                    if (toSwitch.indexOf(i) !== -1)
                    {
                        mp.setPlayerData(pid, 'card', 1 - oddCard);
                    }
                });

            }

            mp.setData('startPlayer', startPlayer);
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

        'host-voteTable': class extends React.Component<TheOddOneHostVoteTableViewInterface, {}> {
            constructor(props: TheOddOneHostVoteTableViewInterface) {
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

                if (major !== -1)
                {
                    const playerTag = mp.getPluginView(
                        'lobby',
                        'player-tag',
                        {
                            clientIndex: major,
                            invertColors: true,
                            border: false
                        });
                    scores.push(
                        React.createElement(
                            'li',
                            {className: 'major'},
                            playerTag, ' - ' + votes[major]));

                }

                for (i = 0; i < this.props.lobby.names.length; i = i + 1) {
                    if (i === major)
                    {
                        continue;
                    }

                    const playerTag = mp.getPluginView(
                        'lobby',
                        'player-tag',
                        {
                            clientIndex: i,
                            invertColors: true,
                            border: false
                        });

                    const voteCount = votes[i] ? ' - ' + votes[i] : null;

                    scores.push(
                        React.createElement(
                            'li',
                            {},
                            playerTag,
                            voteCount));
                }

                if (major === -1) {
                    submitButton = null;
                } else {
                    submitButton = React.createElement('button', {id: 'theoddone-vote-submit', onClick: this.commitVote }, 'Commit Vote!');
                }

                const StandardButton = React.createElement(
                    'button',
                    {onClick: function() { mp.newGame(0); } },
                    'Standard Rule');

                const NowordsButton  = React.createElement(
                    'button',
                    {onClick: function() { mp.newGame(1); } },
                    'Oddone no words rule');

                const playerTag = mp.getPluginView(
                    'lobby',
                    'player-tag',
                    {
                        clientIndex: this.props.startPlayer,
                        invertColors: true,
                        border: false
                    });

                return mp.getPluginView('gameshell',
                                        'HostShell-Main',
                                        {
                                            'links': {
                                                'home': {
                                                    'icon': 'gamepad',
                                                    'label': 'Game',
                                                    'view': React.createElement(
                                                        'div',
                                                        null,
                                                        React.createElement(
                                                            'div',
                                                            { className: 'startFirst' },
                                                            playerTag,
                                                            ' will start first'),
                                                        React.createElement('ol', {id: 'theoddone-votetable'}, scores),
                                                        submitButton)
                                                },
                                                'clients': {
                                                    'icon': 'users',
                                                    'label': 'Players',
                                                    'view': mp.getPluginView('lobby', 'host-roommanagement')
                                                },
                                                'newgame': {
                                                    'icon': 'cog',
                                                    'label': 'Game Type',
                                                    'view': React.createElement(
                                                        'div',
                                                        { className: 'votebuttons' },
                                                        StandardButton,
                                                        NowordsButton
                                                    )
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
                const button = React.createElement('button', {onClick: function() { mp.newGame(); } },
                                                'New Game');
                return mp.getPluginView('gameshell',
                                        'HostShell-Main',
                                        {
                                            'links': {
                                                'home': {
                                                    'icon': 'gamepad',
                                                    'label': 'Game',
                                                    'view': React.createElement(
                                                        'div',
                                                        null,
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
            playerSummary: any,
            gameType: any
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
                        isDead: this.props.playerSummary[i].isDead,
                        gameType: this.props.gameType
                    }));
                }

                return React.createElement('table', {id: 'theoddone-summary-table', cellSpacing: '1px'},
                                       React.createElement(TheOddOneRule.views['host-summaryTable-scoreHeader'], {}),
                                       scores);
            }
        },

        'host-summaryTable-scoreHeader': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return React.createElement('tr',
                    null,
                    React.createElement('th', null, 'Player'),
                    React.createElement('th', null, 'Word'),
                    React.createElement('th', null, 'Score')
                );
            }
        },

        'host-summaryTable-scoreRow': class extends React.Component<ViewPropsInterface & {
            isOdd: boolean,
            isDead: boolean,
            name: string,
            word: string,
            score: string,
            gameType: any
        }, {}> {
            public render() {
                const cn = [];
                if (this.props.isOdd) {
                    cn.push('odd');
                }
                if (this.props.isDead) {
                    cn.push('dead');
                }
                let word = this.props.word;
                if (this.props.isOdd && this.props.gameType === 1)
                {
                    word = '???';
                }
                return React.createElement('tr', {className: cn.join(' ')},
                                    React.createElement('td', {className: 'name'}, this.props.name),
                                    React.createElement('td', null, word),
                                    React.createElement('td', null, this.props.score));
            }
        },

        //
        // Client Views
        //

        'client-voting': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return React.createElement(
                    'div',
                    {id: 'theoddone-voting'},
                    React.createElement(TheOddOneRule.views['client-word'], this.props),
                    React.createElement(TheOddOneRule.views['client-voting-choices'], this.props));
            }
        },

        'client-word': class extends React.Component<ViewPropsInterface & { word: any, gameType: any, isOdd: any }, {}> {
            public render() {
                let word = this.props.word;
                if (this.props.gameType === 1 && this.props.isOdd)
                {
                    word = '???';
                }
                return React.createElement('div', {id: 'theoddone-word'}, word);
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
                        reactChoices.push(
                            React.createElement(
                                'div',
                                {className: 'choice selected'},
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

                        reactChoices.push(
                            React.createElement(
                                'div',
                                {className: 'choice' + deadClass, onClick: oc},
                                player));
                    }
                }

                const cn = vote === -1 ? 'unselected' : 'selected';

                reactChoices.push(React.createElement('div', {className: 'clearer'}));
                return React.createElement('div', {id: 'choices', className: cn}, reactChoices);
            }
        }
    }
};
