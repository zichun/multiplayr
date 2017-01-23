/**
 * Coup
 */

import * as React from 'react';
import * as FontAwesome from 'react-fontawesome';

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
    shuffle,
    forEach
} from '../../common/utils';

enum CoupGameState {
    PlayAction = 1,       // A player chooses an action.
    PlayReaction,         // Other players react to the action chooses - challenge / block etc.
    ReactionResult,       // Shows the result of a challenge / block etc.
    AmbassadorCardChange, // Ambassador action - player choose cards to swap.
    GameOver              // Game over screen.
};

enum CoupAction {
    Duke = 1,    // Take 3 coins from the treasury
    Assassin,    // Pay three coins and try to assassinate another player's character
    Captain,     // Take two coins from another player
    Ambassador,  // Draw two character cards, and choose
    Income,      // Take one coin from the treasury
    ForeignAid,  // Take two coins from the treasury
    Coup         // Spend 7 coins and assassinate an opponent
};

enum CoupCards {
    Duke = 1,
    Assassin,
    Contessa,
    Captain,
    Ambassador,
    Unknown
};

enum CoupCardState {
    Active = 1,
    ChallengeFailed,
    Assassinated,
    Couped
};

interface CoupActionInterface {
    action: CoupAction,
    clientId: string,
    targetId?: string,
    challenge?: string,
    block?: string
};

/**
 * Generate a new deck of cards - 3 of Duke, Assassin, Contessa, Captain, Ambassador.
 */
function newDeck() {
    const deck: CoupCards[] = [];

    for (let i = 0; i < 3; i = i + 3) {
        deck.push(CoupCards.Duke);
        deck.push(CoupCards.Assassin);
        deck.push(CoupCards.Contessa);
        deck.push(CoupCards.Captain);
        deck.push(CoupCards.Ambassador);
    }

    shuffle(deck);

    return deck;
}

function addActions(
    mp: MPType,
    action: CoupActionInterface,
    actionsEl: any[],
    index: number
) {
    switch (action.action) {
        case CoupAction.Income:
            const playerTag =  mp.getPluginView(
                'lobby',
                'player-tag',
                {
                    clientId: action.clientId
                }
            );

            actionsEl.push(
                <li className='coup-actionslist-item income'
                    key={ 'action-' + index }>
                    { playerTag } played <strong>Income</strong>, +1 gold
                </li>
            );
    }
}

/**
 * Checks if a players hand has a given card.
 */
function hasCard(
    cards: any[],
    card: CoupCards
) {
    for (let i = 0; i < cards.length; i = i + 1) {
        if (cards[i].card === card &&
            cards[i].state === CoupCardState.Active) {

            return true;
        }
    }

    return false;
}

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
        const actions = mp.getData('actions');

        mp.setViewProps(mp.hostId, 'actions', actions);

        mp.playersForEach(
            (clientId, index) => {
                mp.setViewProps(clientId, 'coins', playersData[index].coins);
                mp.setViewProps(clientId, 'cards', playersData[index].cards);
                mp.setViewProps(clientId, 'actions', actions);

                const playersCards = {};
                mp.playersForEach(
                    (otherClientId, otherIndex) => {
                        if (index === otherIndex) {
                            return;
                        }

                        playersCards[otherClientId] = [];

                        for (let i = 0; i < 2; i = i + 1) {
                            if (playersData[index].cards[i].state === CoupCardState.Active) {
                                playersCards[otherClientId].push({
                                    card: CoupCards.Unknown,
                                    state: CoupCardState.Active
                                });
                            } else {
                                playersCards[otherClientId].push(playersData[index].cards[i]);
                            }
                        }
                    });

                mp.setViewProps(clientId, 'playersCards', playersCards);
            });

        //
        // Render views based on game state.
        //

        switch (mp.getData('gameState')) {

            case CoupGameState.PlayAction:

                const playerTurn = mp.getData('playerTurn');

                mp.setView(mp.hostId, 'host-playaction');
                mp.playersForEach((clientId, index) => {
                    if (index === playerTurn) {
                        mp.setView(clientId, 'client-playaction');
                    } else {
                        mp.setView(clientId, 'client-waitplayaction');
                    }
                });

                break;

            case CoupGameState.PlayReaction:
                break;

            case CoupGameState.ReactionResult:
                break;

            case CoupGameState.AmbassadorCardChange:
                break;

            case CoupGameState.GameOver:
                break;
        }

        return true;
    },

    methods: {
        'startGame': (mp: MPType) => {
            if (mp.playersCount() < 1) {
                alert('We need at least 1 players to play this game');
            } else {
                mp.newGame();
                mp.setData('lobby_started', true);
            }
        },

        'newGame': (mp: MPType) => {
            const deck = newDeck();
            mp.setData('deck', deck);
            mp.setData('actions', []);
            mp.distributeCards();

            mp.playersForEach((clientId) => {
                mp.setPlayerData(clientId, 'coins', 2);
                mp.setPlayerData(clientId, 'isDead', false);
            });

            mp.setData('playerTurn', Math.floor(Math.random() * mp.playersCount()));
            mp.setData('gameState', CoupGameState.PlayAction);
        },

        'distributeCards': (mp: MPType) => {
            // Distribute 2 cards to each player.
            const deck = mp.getData('deck');

            mp.playersForEach((clientId) => {
                const draw = deck.splice(0, 2);
                const cards = [];

                [0, 1].forEach((i) => {
                    cards.push({
                        card: draw[i],
                        state: CoupCardState.Active
                    });
                });

                mp.setPlayerData(clientId, 'cards', cards);
            });

            mp.setData('deck', deck);
        },

        'takeAction': (
            mp: MPType,
            clientId: string,
            action: CoupAction,
            targetId?: string
        ) => {
            //
            // Verify validity of action.
            //

            if (mp.getData('gameState') !== CoupGameState.PlayAction) {
                throw(new Error('Action can only be taken in PlayAction state'));
            }

            const turn = mp.getData('playerTurn');
            mp.playersForEach(
                (cId, index) => {
                    if (index === turn && clientId !== cId) {
                        throw(new Error('Action can only be on the player\'s turn'));
                    }
                });

            if (targetId && mp.getPlayerData(targetId, 'isDead') === true) {
                throw(new Error('Cannot target a dead player'));
            }

            if (action === CoupAction.Assassin || action === CoupAction.Captain ||
                action === CoupAction.Coup) {

                if (!targetId) {
                    throw(new Error('TargetId not set for an action that requires it'));
                }
            }

            const coins = mp.getPlayerData(clientId, 'coins');
            if (coins >= 10 && action !== CoupAction.Coup) {
                throw(new Error('Coup action must be taken if player has more than 10 coins'));
            }

            if ((action === CoupAction.Coup && coins < 7) ||
                (action === CoupAction.Assassin && coins < 3)) {
                throw(new Error('Insufficient coins to perform action.'));
            }

            const actions = mp.getData('actions');
            const actionObj: CoupActionInterface = {
                action: action,
                clientId: clientId,
                targetId: targetId,
                challenge: null,
                block: null
            };

            actions.push(actionObj);
            mp.setData('actions', actions);

            if (action === CoupAction.Income) {
                // Income action cannot be disputed, continue.
                mp.setPlayerData(clientId, 'coins', coins + 1);
                mp.setData('gameState', CoupGameState.PlayAction);
            } else {
                mp.setData('gameState', CoupGameState.PlayReaction);
            }
        },

        'challengeAction': (
            mp: MPType,
            clientId: string,
        ) => {
        }
    },

    views: {
        'host-lobby': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;
                return mp.getPluginView(
                    'gameshell',
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

        'actions-page': class extends React.Component<ViewPropsInterface & { actions: CoupActionInterface[] }, {}> {
            public render() {
                const actions = this.props.actions;
                const actionsEl = [];

                for (let i = actions.length - 1; i >= 0; i = i - 1) {
                    addActions(this.props.MP, actions[i], actionsEl, i);
                }

                return (
                    <ul className='coup-actionslist'>
                        { actionsEl }
                    </ul>
                );
            }
        },

        'host-playaction': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;
                const playActionPage = React.createElement(CoupRule.views['host-playaction-page'],
                                                           this.props);
                return mp.getPluginView(
                    'gameshell',
                    'HostShell-Main',
                    {
                        'links': {
                            'home': {
                                'icon': 'home',
                                'label': 'Home',
                                'view': playActionPage
                            },
                            'clients': {
                                'icon': 'users',
                                'label': 'Players',
                                'view': mp.getPluginView('lobby', 'host-roommanagement')
                            },
                        }
                    });
            }
        },

        'host-playaction-page': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return <div>hello</div>
            }
        },

        'players-cards': class extends React.Component<ViewPropsInterface & {
            cards: any[],
            playersCards: any[]
        }, {}> {
            public render() {
                const mp = this.props.MP;
                const playersCards = this.props.playersCards;

                const myCard = React.createElement(
                    CoupRule.views['player-card'],
                    {
                        clientId: this.props.MP.clientId,
                        cards: this.props.cards,
                        MP: this.props.MP
                    });

                /* const playersCardsEl = [];

                 * forEach(
                 *     playersCards,
                 *     (card, index) => {
                 *         playersCardsEl.push(
                 *             <div>
                 *             </div>);
                 *     });
                 */
                return (
                    <div className='coup-players-cards'>
                        { myCard }
                    </div>
                );
            }
        },

        'player-card': class extends React.Component<ViewPropsInterface & {
            clientId: string,
            cards: any[]
        }, {}> {
            public render() {
                const cards = this.props.cards;

                const cardsEl = [];
                const playerTag =  this.props.MP.getPluginView(
                    'lobby',
                    'player-tag',
                    {
                        clientId: this.props.clientId,
                        size: '2x',
                        invertColors: true
                    }
                );

                for (let i = 0; i < cards.length; i = i + 1) {
                    const cardName = CoupCards[cards[i].card];
                    cardsEl.push(
                        <div key={ 'card' + i }
                             className='coup-card { cardName }'>
                            <footer>{ cardName }</footer>
                        </div>
                    );
                }

                return (
                    <div className='coup-player-cards'>
                        { playerTag }
                        { cardsEl }
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
                                'label': 'Card',
                                'view': cardsPage
                            },
                            'actionslist': {
                                'icon': 'list',
                                'label': 'Actions History',
                                'view': actionsPage
                            }
                        },
                        'topBarContent': coins
                    });
            }
        },

        'client-playaction-page': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const selectAction = React.createElement(CoupRule.views['client-playaction-page-selectaction'], this.props);
                return (
                    <div className='coup-client-playaction'>
                        <header>Select your action</header>
                        { selectAction }
                    </div>
                );
            }
        },

        'client-playaction-page-selectaction': class extends React.Component<ViewPropsInterface & {
            cards: any[],
            coins: number
        }, {
            action: CoupAction
        }> {
            constructor(props: ViewPropsInterface) {
                super(props);
                this.state = { action: null };
                this._selectAction = this._selectAction.bind(this);
            }

            private _selectAction(choice: string, index: Number) {
                this.setState({ action: CoupAction[choice] });
                return true;
            }

            public render() {
                const mp = this.props.MP;
                const cards = this.props.cards;
                const coins = this.props.coins;
                const choices = [];

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
                                className={ hasCard(cards, CoupCards.Duke) ? '' : 'coup-action-choicelist-lie'}>
                            Duke - Take 3 coins from the treasury
                        </Choice>
                    );
                }

                if (coins >= 3 && coins < 10) {
                    choices.push(
                        <Choice key={ CoupAction[CoupAction.Assassin] }
                                className={ hasCard(cards, CoupCards.Assassin) ? '' : 'coup-action-choicelist-lie'}>
                            Assassin - Spend 3 coins to assassinate another player
                        </Choice>
                    );
                }

                if (coins < 10) {
                    choices.push(
                        <Choice key={ CoupAction[CoupAction.Captain] }
                                className={ hasCard(cards, CoupCards.Captain) ? '' : 'coup-action-choicelist-lie'}>
                            Captain - Steal 2 coins from another player
                        </Choice>
                    );
                }

                if (coins < 10) {
                    choices.push(
                        <Choice key={ CoupAction[CoupAction.Ambassador] }
                                className={ hasCard(cards, CoupCards.Ambassador) ? '' : 'coup-action-choicelist-lie'}>
                            Ambassador - Draw 2 character cards and choose any to replace
                        </Choice>
                    );
                }

                const button = (
                    <button className='coup-action-choicelist-button'
                            disabled={ this.state.action ? false: true }
                            onClick={ this.props.MP.takeAction.bind(this, this.state.action, null) }>
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
                        { button }
                    </div>
                );
            }
        },

        'client-waitplayaction': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const mp = this.props.MP;
                const playActionPage = React.createElement(CoupRule.views['client-playaction-page'], this.props);
                const cards = React.createElement(CoupRule.views['players-cards'], this.props);
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
                                'label': 'Card',
                                'view': cards
                            }
                        },
                        'topBarContent': coins
                    });
            }
        }
    }
};

export default CoupRule;
