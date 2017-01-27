/**
 * Coup.tsx - Rule for Coup game
 */

import * as React from 'react';
import * as FontAwesome from 'react-fontawesome';
import * as colorsys from 'colorsys';

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';

import {
    ChoiceList,
    Choice
} from '../../client/components/ChoiceList';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

import {
    addActions,
    hasCard
} from './CoupFunctions';

import {
    shuffle,
    forEach
} from '../../common/utils';

import {
    CoupGameState,
    CoupAction,
    CoupReaction,
    CoupCard,
    CoupCardState,
    CoupWaitContext,
    CoupActionInterface
} from './CoupTypes';

import {
    CoupStartGame,
    CoupNewGame,
    CoupTakeAction,
    CoupTakeReaction,
    CoupRevealCard,
    CoupAmbassadorAction,
    CoupEndChallengePhase
} from './methods/CoupMethods';

import {
    CoupHostLobby,
    CoupGameRule
} from './views/CoupViews';

export const CoupRule: GameRuleInterface = {

    name: 'coup',
    css: ['coup.css'],

    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },

    globalData: {
        gameState: CoupGameState.PlayAction,
        playerTurn: -1,
        lastAction: {
            player: -1,
            action: CoupAction.Duke,
            challenge: -1,
            block: -1,
        },
        actions: [],
        deck: []
    },

    playerData: {
        coins: 0,
        cards: [],
        isDead: false
    },

    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');

        const showLobby = () => {
            mp.setView(mp.clientId, 'host-lobby');

            mp.playersForEach((clientId) => {
                mp.setView(clientId, 'lobby_SetName');
            });

            return true;
        }

        if (!started) {
            return showLobby();
        }

        //
        // Push props down to clients
        //

        const playersData = mp.getPlayersData(['coins', 'cards']);
        const playerTurn = mp.getData('playerTurn');
        let playerTurnId = null;
        const actions = mp.getData('actions');
        const alivePlayers = [];

        mp.setViewProps(mp.hostId, 'actions', actions);
        mp.setViewProps(mp.hostId, 'playerTurn', playerTurn);

        mp.playersForEach((clientId, index) => {
            if (index === playerTurn) {
                playerTurnId = clientId;
            }
            if (!mp.getPlayerData(clientId, 'isDead')) {
                alivePlayers.push(clientId);
            }
        });

        mp.setViewProps(mp.hostId, 'playerTurnId', playerTurnId);

        mp.playersForEach(
            (clientId, index) => {
                mp.setViewProps(clientId, 'coins', playersData[index].coins);
                mp.setViewProps(clientId, 'cards', playersData[index].cards);
                mp.setViewProps(clientId, 'actions', actions);
                mp.setViewProps(clientId, 'playerTurn', playerTurn);
                mp.setViewProps(clientId, 'playerTurnId', playerTurnId);
                mp.setViewProps(clientId, 'alivePlayers', alivePlayers);
                mp.setViewProps(clientId, 'waitAdditionalText', null);

                const playersCards = {};
                const playersCoins = {};

                mp.playersForEach(
                    (otherClientId, otherIndex) => {
                        if (index === otherIndex) {
                            return;
                        }

                        playersCards[otherClientId] = [];
                        playersCoins[otherClientId] = playersData[otherIndex].coins;

                        for (let i = 0; i < 2; i = i + 1) {
                            if (playersData[otherIndex].cards[i].state === CoupCardState.Active) {
                                playersCards[otherClientId].push({
                                    card: CoupCard.Unknown,
                                    state: CoupCardState.Active
                                });
                            } else {
                                playersCards[otherClientId].push(playersData[otherIndex].cards[i]);
                            }
                        }
                    });

                mp.setViewProps(clientId, 'playersCards', playersCards);
                mp.setViewProps(clientId, 'playersCoins', playersCoins);
            });

        //
        // Render views based on game state.
        //

        switch (mp.getData('gameState')) {

            case CoupGameState.PlayAction:

                mp.setView(mp.hostId, 'host-playaction');

                mp.playersForEach((clientId, index) => {
                    if (index === playerTurn) {
                        mp.setView(clientId, 'client-playaction');
                    } else {
                        mp.setViewProps(clientId, 'waitForId', playerTurnId);
                        mp.setViewProps(clientId, 'waitContext', CoupWaitContext.PlayAction);
                        mp.setView(clientId, 'client-waitforaction');
                    }
                });

                break;

            case CoupGameState.PlayReaction: {
                const lastAction = actions[actions.length - 1];

                mp.setView(mp.hostId, 'host-playreaction');

                if (!lastAction.block) {
                    mp.playersForEach((clientId, index) => {
                        if (index === playerTurn) {
                            mp.setViewProps(clientId, 'waitContext', CoupWaitContext.ChallengeOrBlock);
                            mp.setView(clientId, 'client-waitforaction');
                        } else {
                            mp.setView(clientId, 'client-playreaction');
                        }
                    });
                } else {
                    mp.playersForEach((clientId, index) => {
                        if (clientId === lastAction.block) {
                            mp.setViewProps(clientId, 'waitContext', CoupWaitContext.ChallengeOrBlock);
                            mp.setView(clientId, 'client-waitforaction');
                        } else {
                            mp.setView(clientId, 'client-playreaction');
                        }
                    });
                }

                break;
            }

            case CoupGameState.ChallengeReaction: {
                const lastAction = actions[actions.length - 1];
                const challenge = lastAction.challenge;
                let challengee = null;
                if (lastAction.block) {
                    challengee = lastAction.block;
                } else {
                    challengee = lastAction.clientId;
                }

                mp.setViewProps(mp.hostId, 'waitForId', challenge);
                mp.setView(mp.hostId, 'host-playaction');
                mp.playersForEach((clientId, index) => {
                    if (clientId === challengee) {
                        mp.setView(clientId, 'client-challengereaction');
                    } else {
                        mp.setViewProps(clientId, 'waitForId', challenge);
                        mp.setViewProps(clientId, 'waitContext', CoupWaitContext.ChallengeReaction);
                        mp.setView(clientId, 'client-waitforaction');
                    }
                });
                break;
            }

            case CoupGameState.ChallengeResult: {
                const lastAction = actions[actions.length - 1];
                const challengeLoser = lastAction.challengeLoser;
                const challengeWinner = lastAction.challengeWinner;

                mp.setViewProps(mp.hostId, 'waitForId', challengeLoser);
                mp.setView(mp.hostId, 'host-playaction');
                mp.playersForEach((clientId, index) => {
                    if (clientId === challengeLoser) {
                        mp.setView(clientId, 'client-chooseloseinfluence');
                    } else if (clientId === challengeWinner) {
                        mp.setViewProps(clientId, 'waitForId', challengeLoser);
                        mp.setViewProps(clientId, 'waitAdditionalText', 'Your challenged card has been replaced! ');
                        mp.setViewProps(clientId, 'waitContext', CoupWaitContext.ChallengeFail);
                        mp.setView(clientId, 'client-waitforaction');
                    } else {
                        mp.setViewProps(clientId, 'waitForId', challengeLoser);
                        mp.setViewProps(clientId, 'waitContext', CoupWaitContext.ChallengeFail);
                        mp.setView(clientId, 'client-waitforaction');
                    }
                });
                break;
            }

            case CoupGameState.AmbassadorCardChange: {
                const lastAction = actions[actions.length - 1];
                const deck = mp.getData('deck');
                const drawCards = [deck[0], deck[1]];

                mp.setView(mp.hostId, 'host-playaction');
                mp.playersForEach((clientId, index) => {
                    if (clientId === lastAction.clientId) {
                        mp.setViewProps(clientId, 'drawCards', drawCards);
                        mp.setView(clientId, 'client-ambassadorcardchange');
                    } else {
                        mp.setViewProps(clientId, 'waitForId', lastAction.clientId);
                        mp.setViewProps(clientId, 'waitContext', CoupWaitContext.AmbassadorChooseCard);
                        mp.setView(clientId, 'client-waitforaction');
                    }
                });

                break;
            }

            case CoupGameState.GameOver:
                let aliveCount = 0;
                let winnerId = null;

                mp.playersForEach(
                    (clientId, index) => {
                        if (!mp.getPlayerData(clientId, 'isDead')) {
                            aliveCount++;
                            winnerId = clientId;
                        }
                    });

                if (aliveCount !== 1) {
                    throw(new Error('Game should not be over with non-1 alive players'));
                }

                mp.playersForEach(
                    (clientId, index) => {
                        mp.setViewProps(clientId, 'winner', winnerId);
                        mp.setView(clientId, 'client-showWinner');
                    });

                mp.setViewProps(mp.hostId, 'winner', winnerId);
                mp.setView(mp.hostId, 'host-showWinner');

                break;
        }

        mp.playersForEach((clientId, index) => {
            if (mp.getPlayerData(clientId, 'isDead')) {
                mp.setView(clientId, 'client-dead');
            }
        });

        return true;
    },

    methods: {
        'startGame': CoupStartGame,
        'newGame': CoupNewGame,
        'takeAction': CoupTakeAction,
        'takeReaction': CoupTakeReaction,
        'revealCard': CoupRevealCard,
        'ambassadorAction': CoupAmbassadorAction,
        'endChallengePhase': CoupEndChallengePhase
    },

    views: {
        'host-lobby': CoupHostLobby,

        'actions-page': class extends React.Component<ViewPropsInterface & { actions: CoupActionInterface[] }, {}> {
            public render() {
                const actions = this.props.actions;
                const actionsEl = [];

                for (let i = actions.length - 1; i >= 0; i = i - 1) {
                    addActions(this.props.MP, actions[i], actionsEl, i);
                }

                return (
                    <div className='coup-actions-page'>
                        <header>Actions history</header>
                        <ul className='coup-actionslist'>
                            { actionsEl }
                        </ul>
                    </div>
                );
            }
        },

        /**
         * Last Action (common) - show last action.
         */
        'last-action': class extends React.Component<ViewPropsInterface & {
            actions: CoupActionInterface[]
        }, {}> {
            public render() {
                const actions = this.props.actions;

                if (actions.length === 0) {
                    return null;
                } else {
                    const action = actions[actions.length - 1];
                    const actionsEl = [];

                    addActions(this.props.MP, action, actionsEl);

                    return (
                        <ul className='coup-actionslist coup-lastaction'>
                            { actionsEl }
                        </ul>
                    );
                }
            }
        },

        /**
         * Players Cards (client) - shows player cards.
         */
        'players-cards': class extends React.Component<ViewPropsInterface & {
            cards: any[],
            coins: number,
            playersCards: any,
            playersCoins: any,
            lobby: any
        }, {}> {
            public render() {
                const mp = this.props.MP;
                const playersCards = this.props.playersCards;
                const playersCoins = this.props.playersCoins;

                let i = 0;
                for (i = 0; i < this.props.lobby.clientIds.length; i = i + 1) {
                    if (this.props.MP.clientId === this.props.lobby.clientIds[i]) {
                        break;
                    }
                }

                const myCard = React.createElement(
                    CoupRule.views['player-card'],
                    {
                        clientId: this.props.MP.clientId,
                        coins: this.props.coins,
                        cards: this.props.cards,
                        MP: this.props.MP,
                        accent: this.props.lobby.accents[i]
                    });

                const separator = (<div className='coup-seperator'>&nbsp;</div>);

                const playersCardsEl = [];

                forEach(
                    playersCards,
                    (clientId, cards) => {
                        let i = 0;
                        for (i = 0; i < this.props.lobby.clientIds.length; i = i + 1) {
                            if (clientId === this.props.lobby.clientIds[i]) {
                                break;
                            }
                        }

                        playersCardsEl.push(
                            React.createElement(
                                CoupRule.views['player-card'],
                                {
                                    clientId: clientId,
                                    coins: playersCoins[clientId],
                                    cards: cards,
                                    MP: this.props.MP,
                                    accent: this.props.lobby.accents[i],
                                    key: 'player-card-' + clientId
                                }));
                    });

                return (
                    <div className='coup-players-cards'>
                        { myCard }
                        { separator }
                        { playersCardsEl }
                    </div>
                );
            }
        },

        'player-card': class extends React.Component<ViewPropsInterface & {
            clientId: string,
            coins: number,
            cards: any[],
            accent: string
        }, {}> {
            public render() {
                const cards = this.props.cards;
                const coins = this.props.coins;
                const accentHsv = colorsys.hex_to_hsv(this.props.accent);
                const accent = this.props.accent;
                /* const accent = colorsys.hsv_to_hex({
                 *     h: accentHsv.h,
                 *     s: accentHsv.s / 1.5,
                 *     v: accentHsv.v
                 * });*/
                const accentLight = colorsys.hsv_to_hex({
                    h: accentHsv.h,
                    s: accentHsv.s / 4,
                    v: 100
                });

                const cardsEl = [];
                const playerTag =  this.props.MP.getPluginView(
                    'lobby',
                    'player-tag',
                    {
                        clientId: this.props.clientId,
                        size: 'medium',
                        invertColors: true,
                        className: 'coup-player-cards-tag'
                    }
                );

                const coinsEl = (
                    <div className='coup-player-coin'
                         style={{ backgroundColor: accent }}>
                        <FontAwesome name='usd' />
                        &nbsp;
                        { this.props.coins }
                    </div>
                );


                for (let i = 0; i < cards.length; i = i + 1) {
                    const cardName = CoupCard[cards[i].card];
                    cardsEl.push(
                        React.createElement(
                            CoupRule.views['card'],
                            {
                                card: cards[i],
                                accent: accentLight,
                                key: 'card' + i
                            }));
                }

                return (
                    <div className='coup-player-cards'
                         key={ 'player-cards-' + this.props.clientId }>
                        { playerTag }
                        { coinsEl }
                        <div />
                        <div className='coup-player-cards-container'
                             style={{ borderColor: accent,
                                      backgroundColor: accent }}>
                            { cardsEl }
                        </div>
                    </div>
                );
            }
        },

        'card': class extends React.Component<{
            card: any,
            accent: string
        }, {}> {
            public render() {
                const card = this.props.card;
                const cardName = CoupCard[card.card];
                let footer = null;

                if (card.state !== CoupCardState.Active) {
                    footer = (
                        <footer className={ CoupCardState[card.state] }>
                            { CoupCardState[card.state] }
                        </footer>
                    );
                }

                return (
                    <div className={ 'coup-card ' + cardName }>
                        <header style={{ backgroundColor: this.props.accent }}>
                            { cardName }
                        </header>
                        { footer }
                    </div>
                );
            }
        },

        'client-coins': class extends React.Component<ViewPropsInterface & { coins: Number }, {}> {
            public render() {
                const mp = this.props.MP;
                return (
                    <div className='coup-client-coin'>
                        <FontAwesome name='usd' />
                        &nbsp;
                        { this.props.coins }
                    </div>
                );
            }
        },

        /**
         * PlayAction (Host) views
         */
        'host-playaction': class extends React.Component<ViewPropsInterface & {
            playerTurnId: string,
            actions: any,
            waitForId?: string
        }, {}> {
            public render() {
                const mp = this.props.MP;
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);
                const waitId = this.props.waitForId ? this.props.waitForId : this.props.playerTurnId;

                const waitActionPage = React.createElement(
                    CoupRule.views['client-waitforaction-page'],
                    {
                        MP: mp,
                        actions: this.props.actions,
                        waitForId: waitId,
                        waitContext: CoupWaitContext.PlayAction
                    });

                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'home',
                                'label': 'Home',
                                'view': waitActionPage
                            },
                            'clients': {
                                'icon': 'users',
                                'label': 'Players',
                                'view': mp.getPluginView('lobby', 'host-roommanagement')
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        }
                    });
            }
        },

        /**
         * PlayReaction page (host) - allows clients to challenge before a timer expires
         */
        'host-playreaction': class extends React.Component<ViewPropsInterface & {
            playerTurnId: string,
            actions: any
        }, {}> {
            public render() {
                const mp = this.props.MP;
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);
                const playReactionPage = React.createElement(CoupRule.views['host-playreaction-page'], {
                    MP: this.props.MP,
                    key: this.props.playerTurnId + Math.random(),
                    actions: this.props.actions
                });

                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'home',
                                'label': 'Home',
                                'view': playReactionPage
                            },
                            'clients': {
                                'icon': 'users',
                                'label': 'Players',
                                'view': mp.getPluginView('lobby', 'host-roommanagement')
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        }
                    });
            }
        },

        'host-playreaction-page': class extends React.Component<ViewPropsInterface, { timeLeft: number }> {
            private _interval;
            constructor(props: ViewPropsInterface) {
                super(props);
                this.state = { timeLeft: 10 };
                this._tick = this._tick.bind(this);
            }
            private _tick() {
                if (this.state.timeLeft > 0) {
                    this.setState({ timeLeft: this.state.timeLeft - 1});
                } else {
                    this.props.MP.endChallengePhase();
                }
            }
            public componentWillUnmount() {
                if (this._interval) {
                    clearInterval(this._interval);
                }
            }
            public componentDidMount() {
                this._interval = setInterval(this._tick, 1000);
            }
            private _endChallenge() {
                this.props.MP.endChallengePhase();
            }
            public render() {
                const mp = this.props.MP;
                const lastAction = React.createElement(CoupRule.views['last-action'], this.props);
                const button = (
                    <button className='coup-button'
                            onClick={ this._endChallenge.bind(this) }>
                        End Challenge Phase ({ this.state.timeLeft })
                    </button>);

                return (
                    <div>
                        { lastAction }
                        { button }
                    </div>
                );
            }
        },

        /**
         * Wait for action page (client).
         */
        'client-waitforaction': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;
                const waitActionPage = React.createElement(CoupRule.views['client-waitforaction-page'], this.props);
                const cards = React.createElement(CoupRule.views['players-cards'], this.props);
                const coins = React.createElement(CoupRule.views['client-coins'], this.props);
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);

                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'gamepad',
                                'label': 'Coup',
                                'view': waitActionPage
                            },
                            'cards': {
                                'icon': 'address-card',
                                'label': 'Cards',
                                'view': cards
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        },
                        'topBarContent': coins
                    });
            }
        },

        'client-waitforaction-page': class extends React.Component<ViewPropsInterface & {
            waitForId?: string,
            waitAdditionalText?: string
            waitContext: CoupWaitContext
        }, {}> {
            public render() {
                const mp = this.props.MP;
                const lastAction = React.createElement(CoupRule.views['last-action'], this.props);

                if (this.props.waitContext === CoupWaitContext.ChallengeOrBlock) {
                    return (
                        <div>
                            { lastAction }
                            { this.props.waitAdditionalText }
                            Waiting for other players to challenge or block.
                        </div>
                    );
                } else {
                    const player = this.props.MP.getPluginView(
                        'lobby',
                        'player-tag',
                        {
                            clientId: this.props.waitForId,
                            invertColors: true
                        }
                    );

                    let waitingAction = null;
                    if (this.props.waitContext === CoupWaitContext.PlayAction) {
                        waitingAction = (<span>make a move</span>);
                    } else if (this.props.waitContext === CoupWaitContext.ChallengeFail) {
                        waitingAction = (<span>pick a character card to reveal</span>);
                    } else if (this.props.waitContext === CoupWaitContext.AmbassadorChooseCard) {
                        waitingAction = (<span>swap character cards (Ambassador)</span>);
                    } else if (this.props.waitContext === CoupWaitContext.ChallengeReaction) {
                        waitingAction = (<span>reveal challenged card</span>);
                    }

                    return (
                        <div>
                            { lastAction }
                            { this.props.waitAdditionalText }
                            Waiting for { player } to { waitingAction }.
                        </div>
                    );
                }
            }
        },

        /**
         * PlayAction (Client) views
         */
        'client-playaction': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;
                const playActionPage = React.createElement(CoupRule.views['client-playaction-page'], this.props);
                const cardsPage = React.createElement(CoupRule.views['players-cards'], this.props);
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);
                const coins = React.createElement(CoupRule.views['client-coins'], this.props);

                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'gamepad',
                                'label': 'Coup',
                                'view': playActionPage
                            },
                            'cards': {
                                'icon': 'address-card',
                                'label': 'Cards',
                                'view': cardsPage
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        },
                        'topBarContent': coins
                    });
            }
        },

        'client-playaction-page': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const lastAction = React.createElement(CoupRule.views['last-action'], this.props);
                const selectAction = React.createElement(CoupRule.views['client-playaction-page-selectaction'], this.props);

                return (
                    <div className='coup-client-playaction'>
                        { lastAction }
                        <header>Select your action</header>
                        { selectAction }
                    </div>
                );
            }
        },

        'client-playaction-page-selectaction': class extends React.Component<ViewPropsInterface & {
            cards: any[],
            coins: number,
            alivePlayers: string[]
        }, {
            action: CoupAction,
            player: string
        }> {
            constructor(props: ViewPropsInterface) {
                super(props);
                this.state = {
                    action: null,
                    player: null
                };
                this._selectAction = this._selectAction.bind(this);
                this._selectPlayer = this._selectPlayer.bind(this);
            }

            private _selectAction(choice: string, index: Number) {
                this.setState({
                    action: CoupAction[choice],
                    player: this.state.player
                });
                return true;
            }

            private _selectPlayer(choice: string, index: Number) {
                this.setState({
                    action: this.state.action,
                    player: choice
                });
                return true;
            }

            private _takeAction() {
                return this.props.MP.takeAction(this.state.action, this.state.player)
            }

            public render() {
                const mp = this.props.MP;
                const { cards, coins, alivePlayers } = this.props;
                const choices = [];
                const playerChoices = [];

                for (let i = 0; i < alivePlayers.length; i = i + 1) {
                    if (alivePlayers[i] === this.props.MP.clientId) {
                        continue;
                    }

                    const player = this.props.MP.getPluginView(
                        'lobby',
                        'player-tag',
                        {
                            clientId: alivePlayers[i],
                            invertColors: false
                        }
                    );

                    playerChoices.push(
                        <Choice key={ alivePlayers[i] }>
                            { player }
                        </Choice>
                    );
                }
                let playerChoicesStyle = { display: 'none' };
                let disabled = true;

                if (this.state.action) {
                    disabled = false;
                }

                if (this.state.action === CoupAction.Assassin ||
                    this.state.action === CoupAction.Captain ||
                    this.state.action === CoupAction.Coup) {
                    playerChoicesStyle = { display: 'block' };
                    if (!this.state.player) {
                        disabled = true;
                    }
                }

                if (coins >= 7) {
                    choices.push(
                        <Choice key={ CoupAction[CoupAction.Coup] }>
                            Coup - Spend 7 coins and assassinate an opponent
                        </Choice>
                    );
                }

                if (coins < 10) {
                    choices.push(
                        <Choice key={ CoupAction[CoupAction.Income] }>
                            Income - Take 1 coin from the treasury
                        </Choice>
                    );
                }

                if (coins < 10) {
                    choices.push(
                        <Choice key={ CoupAction[CoupAction.ForeignAid] }>
                            ForeignAid - Take 2 coins from the treasury
                        </Choice>
                    );
                }

                if (coins < 10) {
                    choices.push(
                        <Choice key={ CoupAction[CoupAction.Duke] }
                                className={ hasCard(cards, CoupCard.Duke) ? '' : 'coup-action-choicelist-lie'}>
                            Duke - Take 3 coins from the treasury
                        </Choice>
                    );
                }

                if (coins >= 3 && coins < 10) {
                    choices.push(
                        <Choice key={ CoupAction[CoupAction.Assassin] }
                                className={ hasCard(cards, CoupCard.Assassin) ? '' : 'coup-action-choicelist-lie'}>
                            Assassin - Spend 3 coins to assassinate another player
                        </Choice>
                    );
                }

                if (coins < 10) {
                    choices.push(
                        <Choice key={ CoupAction[CoupAction.Captain] }
                                className={ hasCard(cards, CoupCard.Captain) ? '' : 'coup-action-choicelist-lie'}>
                            Captain - Steal 2 coins from another player
                        </Choice>
                    );
                }

                if (coins < 10) {
                    choices.push(
                        <Choice key={ CoupAction[CoupAction.Ambassador] }
                                className={ hasCard(cards, CoupCard.Ambassador) ? '' : 'coup-action-choicelist-lie'}>
                            Ambassador - Draw 2 character cards and choose any to replace
                        </Choice>
                    );
                }

                const button = (
                    <button className='coup-action-choicelist-button'
                            disabled={ disabled }
                            onClick={ this._takeAction.bind(this) }>
                        Take Action!
                    </button>
                );

                return (
                    <div>
                        <ChoiceList onSelect={ this._selectAction }
                                    selectedKey={ CoupAction[this.state.action] }
                                    className='coup-action-choicelist'
                                    itemClassName='coup-action-choicelist-item'>
                            { choices }
                        </ChoiceList>
                        <ChoiceList onSelect={ this._selectPlayer }
                                    selectedKey={ this.state.player }
                                    className='coup-action-choicelist'
                                    itemClassName='coup-action-choicelist-item'
                                    style={ playerChoicesStyle }>
                            { playerChoices }
                        </ChoiceList>
                        { button }
                    </div>
                );
            }
        },

        /**
         * PlayReaction (Client) views
         */
        'client-playreaction': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;
                const playReactionPage = React.createElement(CoupRule.views['client-playreaction-page'], this.props);
                const cardsPage = React.createElement(CoupRule.views['players-cards'], this.props);
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);
                const coins = React.createElement(CoupRule.views['client-coins'], this.props);

                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'gamepad',
                                'label': 'Coup',
                                'view': playReactionPage
                            },
                            'cards': {
                                'icon': 'address-card',
                                'label': 'Cards',
                                'view': cardsPage
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        },
                        'topBarContent': coins
                    });
            }
        },

        'client-playreaction-page': class extends React.Component<ViewPropsInterface & {
            actions: any
        }, {
            reaction: CoupReaction
        }> {
            constructor(props: ViewPropsInterface) {
                super(props);
                this.state = { reaction: null };
                this._selectReaction = this._selectReaction.bind(this);
            }

            private _selectReaction(choice: string, index: Number) {
                this.setState({ reaction: CoupReaction[choice] });
                return true;
            }

            private _takeReaction() {
                this.props.MP.takeReaction(this.state.reaction);
            }

            public render() {
                const actions = this.props.actions;
                const lastAction = React.createElement(CoupRule.views['last-action'], this.props);
                const { action, block, challenge, targetId } = actions[actions.length - 1];
                const choices = [];


                if (action === CoupAction.ForeignAid && !block) {
                    choices.push(
                        <Choice key={ CoupReaction[CoupReaction.Block] }>
                            Block
                        </Choice>
                    );
                } else {

                    if (!challenge) {
                        choices.push(
                            <Choice key={ CoupReaction[CoupReaction.Challenge] }>
                                Challenge
                            </Choice>
                        );
                    }

                    if (targetId === this.props.MP.clientId &&
                        !challenge &&
                        !block) {

                        choices.push(
                            <Choice key={ CoupReaction[CoupReaction.Block] }>
                                Block
                            </Choice>
                        );
                    }
                }

                const button = (
                    <button className='coup-action-choicelist-button'
                            style={ this.state.reaction ? { display: 'block' } : { display: 'none' } }
                            onClick={ this._takeReaction.bind(this) }>
                        Confirm { CoupReaction[this.state.reaction] } Reaction!
                    </button>
                );

                return (
                    <div>
                        { lastAction }
                        <header>Select your reaction</header>
                        <ChoiceList onSelect={ this._selectReaction }
                                    selectedKey={ CoupReaction[this.state.reaction] }>
                            { choices }
                        </ChoiceList>
                        { button }
                    </div>
                );
            }
        },

        'client-challengereaction': class extends React.Component<ViewPropsInterface & {
            lobby: any,
            cards: any,
            actions: any
        }, {}> {
            public render() {
                const mp = this.props.MP;
                const chooseLoseInfluencePage = React.createElement(CoupRule.views['client-chooseloseinfluence-page'], {
                    MP: this.props.MP,
                    lobby: this.props.lobby,
                    cards: this.props.cards,
                    actions: this.props.actions,
                    additionalText: 'You have been challenged. If you choose to reveal the right card, you\'ll win the challenge and the card will be replaced. Otherwise, you\'ll lose the revealed card.'
                });
                const cardsPage = React.createElement(CoupRule.views['players-cards'], this.props);
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);
                const coins = React.createElement(CoupRule.views['client-coins'], this.props);
                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'gamepad',
                                'label': 'Coup',
                                'view': chooseLoseInfluencePage
                            },
                            'cards': {
                                'icon': 'address-card',
                                'label': 'Cards',
                                'view': cardsPage
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        },
                        'topBarContent': coins
                    });
            }
        },

        /**
         * Choose lose influence (Client) views - when player fails a challenge, view to choose card
         * to discard.
         */
        'client-chooseloseinfluence': class extends React.Component<ViewPropsInterface & {
            lobby: any,
            cards: any,
            actions: any,
        }, {}> {
            public render() {
                const mp = this.props.MP;
                const chooseLoseInfluencePage = React.createElement(CoupRule.views['client-chooseloseinfluence-page'], {
                    MP: this.props.MP,
                    lobby: this.props.lobby,
                    cards: this.props.cards,
                    actions: this.props.actions,
                    additionalText: 'You have lost a challenge. Choose a card to reveal.'
                });
                const cardsPage = React.createElement(CoupRule.views['players-cards'], this.props);
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);
                const coins = React.createElement(CoupRule.views['client-coins'], this.props);

                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'gamepad',
                                'label': 'Coup',
                                'view': chooseLoseInfluencePage
                            },
                            'cards': {
                                'icon': 'address-card',
                                'label': 'Cards',
                                'view': cardsPage
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        },
                        'topBarContent': coins
                    });
            }
        },

        'client-chooseloseinfluence-page': class extends React.Component<ViewPropsInterface & {
            cards: any[],
            lobby: any,
            additionalText?: string
        }, {
            card: string
        }> {
            constructor(props: ViewPropsInterface) {
                super(props);
                this.state = { card: null };
                this._selectCard = this._selectCard.bind(this);
            }

            private _selectCard(choice: string, index: Number) {
                this.setState({ card: choice });
                return true;
            }

            private _revealCard() {
                this.props.MP.revealCard(this.state.card);
            }

            public render() {
                const mp = this.props.MP;
                const lastAction = React.createElement(CoupRule.views['last-action'], this.props);
                const cards = this.props.cards;
                const choices = [];

                for (let i = 0; i < cards.length; i = i + 1) {
                    if (cards[i].state !== CoupCardState.Active) {
                        continue;
                    }
                    const card = React.createElement(
                        CoupRule.views['card'],
                        {
                            card: cards[i],
                            accent: this.props.lobby.accent
                        });

                    choices.push(
                        <Choice key={ i }>
                            { card }
                        </Choice>
                    );
                }

                const button = (
                    <button className='coup-action-choicelist-button'
                            disabled={ this.state.card === null ? true : false }
                            onClick={ this._revealCard.bind(this) }>
                        Reveal this card
                    </button>
                );

                return (
                    <div className='coup-chooseloseinfluence'>
                        { lastAction }
                        { this.props.additionalText }
                        <ChoiceList onSelect={ this._selectCard }
                                    selectedKey={ this.state.card }
                                    className='coup-card-choicelist'
                                    itemClassName='coup-card-choicelist-item'>
                            { choices }
                        </ChoiceList>
                        { button }
                    </div>
                );
            }
        },

        /**
         * Show player is dead (client)
         */
        'client-dead': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;
                const cardsPage = React.createElement(CoupRule.views['players-cards'], this.props);
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);
                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'exclamation-triangle',
                                'label': 'Coup',
                                'view': 'You Are Dead'
                            },
                            'cards': {
                                'icon': 'address-card',
                                'label': 'Cards',
                                'view': cardsPage
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        },
                        'topBarContent': 'xxx'
                    });
            }
        },

        'client-ambassadorcardchange': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;
                const ambassadorCardChange = React.createElement(CoupRule.views['client-ambassadorcardchange-page'], this.props);
                const cardsPage = React.createElement(CoupRule.views['players-cards'], this.props);
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);
                const coins = React.createElement(CoupRule.views['client-coins'], this.props);

                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'gamepad',
                                'label': 'Coup',
                                'view': ambassadorCardChange
                            },
                            'cards': {
                                'icon': 'address-card',
                                'label': 'Cards',
                                'view': cardsPage
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        },
                        'topBarContent': coins
                    });
            }
        },

        'client-ambassadorcardchange-page': class extends React.Component<ViewPropsInterface & {
            drawCards: CoupCard[],
            cards: any,
            lobby: any,
        }, {
            cards: string[]
        }> {
            constructor(props: any) {
                super(props);
                this.state = { cards: [] };
                this._selectCard = this._selectCard.bind(this);
                this._unselectCard = this._unselectCard.bind(this);
            }

            private _selectCard(choice: string, index: Number) {
                let cards = this.state.cards;
                for (let i = 0; i < cards.length; i++) {
                    if (cards[i] === choice) {
                        return;
                    }
                }
                cards.push(choice);
                this.setState({ cards: cards });
                return true;
            }

            private _unselectCard(choice: string, index: Number) {
                const tr = [];
                for (let i = 0; i < this.state.cards.length; i++) {
                    if (this.state.cards[i] !== choice) {
                        tr.push(this.state.cards[i]);
                    }
                }
                this.setState({ cards: tr });
                return true;
            }

            private _ambassadorAction() {
                this.props.MP.ambassadorAction(this.state.cards);
            }

            public render() {
                const drawCards = this.props.drawCards;
                const cards = this.props.cards;
                const choices = [];
                let neededCount = 0;

                choices.push(
                    <li key='your-card' className='seperator'>Your cards</li>
                );

                for (let i = 0; i < cards.length; i = i + 1) {
                    if (cards[i].state === CoupCardState.Active) {
                        const card = React.createElement(
                            CoupRule.views['card'],
                            {
                                card: cards[i],
                                accent: this.props.lobby.accent
                            });

                        choices.push(
                            <Choice key={ i }>
                                { card }
                            </Choice>
                        );
                        neededCount = neededCount + 1;
                    }
                }

                choices.push(
                    <li key='drawn-cards' className='seperator'>Drawn cards</li>
                );

                for (let i = 0; i < drawCards.length; i = i + 1) {
                    const card = React.createElement(
                        CoupRule.views['card'],
                        {
                            card: {
                                card: drawCards[i],
                                state: CoupCardState.Active
                            },
                            accent: '#ffffff'
                        });

                    choices.push(
                        <Choice key={ i + cards.length }>
                            { card }
                        </Choice>
                    );
                }

                const button = (
                    <button className='coup-action-choicelist-button'
                            disabled={ this.state.cards.length === neededCount ? false : true }
                            onClick={ this._ambassadorAction.bind(this) }>
                        Pick these cards
                    </button>
                );

                return (
                    <div className='coup-ambassadorchoosecard'>
                        <ChoiceList onSelect={ this._selectCard }
                                    onUnselect={ this._unselectCard }
                                    multi={ true }
                                    selectedKeys={ this.state.cards }
                                    className='coup-card-choicelist'
                                    itemClassName='coup-card-choicelist-item'>
                            { choices }
                        </ChoiceList>
                        { button }
                    </div>
                );
            }
        },

        /**
         * Show winner page
         */
        'client-showWinner': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;
                const showWinnerPage = React.createElement(CoupRule.views['client-showWinner-page'], this.props);
                const cardsPage = React.createElement(CoupRule.views['players-cards'], this.props);
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);
                const coins = React.createElement(CoupRule.views['client-coins'], this.props);

                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'gamepad',
                                'label': 'Coup',
                                'view': showWinnerPage
                            },
                            'cards': {
                                'icon': 'address-card',
                                'label': 'Cards',
                                'view': cardsPage
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        },
                        'topBarContent': coins
                    });
            }
        },

        'client-showWinner-page': class extends React.Component<ViewPropsInterface & { winner: string }, {}> {
            public render() {
                const mp = this.props.MP;

                const player = this.props.MP.getPluginView(
                    'lobby',
                    'player-tag',
                    {
                        clientId: this.props.winner,
                        invertColors: true
                    }
                );

                return (<div>
                    { player } has won!
                </div>);
            }
        },

        'host-showWinner': class extends React.Component<ViewPropsInterface, {}> {
            private _newGame() {
                this.props.MP.newGame();
            }
            public render() {
                const mp = this.props.MP;
                const showWinnerPage = React.createElement(CoupRule.views['client-showWinner-page'], this.props);
                const actionsPage = React.createElement(CoupRule.views['actions-page'], this.props);

                const button = (
                    <button className='coup-button'
                            onClick={ this._newGame.bind(this) }>
                        New Game!
                    </button>);

                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'home',
                                'label': 'Home',
                                'view': (
                                    <div>
                                        { showWinnerPage }
                                        { button }
                                    </div>
                                )
                            },
                            'clients': {
                                'icon': 'users',
                                'label': 'Players',
                                'view': mp.getPluginView('lobby', 'host-roommanagement')
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            },
                            'rules': {
                                'icon': 'book',
                                'label': 'Rules',
                                'view': CoupGameRule
                            }
                        }
                    });
            }
        }
    }
};

export default CoupRule;
