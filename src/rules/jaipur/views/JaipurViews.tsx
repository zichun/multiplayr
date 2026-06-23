/**
 * JaipurViews.tsx - React components for Jaipur
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { GameStatus, Card, CardType, Token, PlayerState, MoveRecord, RoundResult } from '../JaipurGameState';

// Helper to map card types to Emojis (icon-replacement ONLY)
export const goodsEmoji = (type: CardType): string => {
    switch (type) {
        case 'diamonds': return '💎';
        case 'gold': return '🪙';
        case 'silver': return '🥈';
        case 'cloth': return '🧵';
        case 'spice': return '🌶️';
        case 'leather': return '👜';
        case 'camels': return '🐫';
        default: return '❓';
    }
};

export const goodsLabel = (type: CardType): string => {
    switch (type) {
        case 'diamonds': return 'Diamonds';
        case 'gold': return 'Gold';
        case 'silver': return 'Silver';
        case 'cloth': return 'Cloth';
        case 'spice': return 'Spice';
        case 'leather': return 'Leather';
        case 'camels': return 'Camels';
        default: return '';
    }
};

// Lobby Views
export class JaipurHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1; // Host + clients

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'gameName': 'Jaipur',
                'links': {
                    'home': {
                        'icon': 'home',
                        'label': 'Lobby',
                        'view': (
                            <div className="jaipur-rules-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
                                <h2>Jaipur Lobby</h2>
                                {mp.getPluginView('lobby', 'SetNameWithLobby')}
                                <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                                    {playerCount !== 2 && (
                                        <p style={{ color: '#C25A3F', fontWeight: 'bold', fontSize: '0.9em', textAlign: 'center' }}>
                                            ⚠️ Jaipur is strictly a 2-player game. Currently {playerCount} player(s) in lobby.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    },
                    'clients': {
                        'icon': 'users',
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': <JaipurRulesView />
                    }
                }
            }
        );
    }
}

export class JaipurClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'gameName': 'Jaipur',
                'links': {
                    'home': {
                        'icon': 'id-card',
                        'label': 'Lobby',
                        'view': (
                            <div className="jaipur-rules-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
                                <h2>Jaipur Lobby</h2>
                                {mp.getPluginView('lobby', 'SetNameWithLobby')}
                                <div style={{
                                    backgroundColor: '#F4C430',
                                    padding: '15px',
                                    border: '3px solid #000',
                                    boxShadow: '4px 4px 0px #000',
                                    fontWeight: 700,
                                    textAlign: 'center',
                                    marginTop: '20px',
                                    textTransform: 'uppercase'
                                }}>
                                    Waiting for Host to start...
                                </div>
                            </div>
                        )
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': <JaipurRulesView />
                    }
                }
            });
    }
}

// Rules Reference View
export class JaipurRulesView extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="jaipur-rules-panel">
                <div className="rules-section">
                    <h3>Objective</h3>
                    <p>
                        Be the richer trader at the end of each round to earn a <strong>Seal of Excellence</strong>.
                        The first player to win <strong>2 Seals of Excellence</strong> wins the game!
                    </p>
                </div>

                <div className="rules-section">
                    <h3>Available Cards (55 total)</h3>
                    <table className="brutalist-table" style={{ width: '100%', borderCollapse: 'collapse', border: '3px solid #000', marginBottom: '15px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#F4C430', borderBottom: '3px solid #000' }}>
                                <th style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'left', fontWeight: '800' }}>Type</th>
                                <th style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: '800' }}>Count</th>
                                <th style={{ padding: '6px', textAlign: 'left', fontWeight: '800' }}>Category</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>💎 Diamonds</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>6</td>
                                <td style={{ padding: '6px' }}>Expensive</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>🪙 Gold</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>6</td>
                                <td style={{ padding: '6px' }}>Expensive</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>🥈 Silver</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>6</td>
                                <td style={{ padding: '6px' }}>Expensive</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>🧵 Cloth</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>8</td>
                                <td style={{ padding: '6px' }}>Cheap</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>🌶️ Spice</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>8</td>
                                <td style={{ padding: '6px' }}>Cheap</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>👜 Leather</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>10</td>
                                <td style={{ padding: '6px' }}>Cheap</td>
                            </tr>
                            <tr style={{ borderBottom: '3px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>🐫 Camels</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>11</td>
                                <td style={{ padding: '6px' }}>Special (Private Herd)</td>
                            </tr>
                            <tr style={{ fontWeight: '800', backgroundColor: '#eee' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>Total</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>55</td>
                                <td style={{ padding: '6px' }}>-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="rules-section">
                    <h3>Rupee Tokens & Values</h3>
                    <p>
                        When selling goods, you claim the corresponding token from the top of the stack (which are stacked in descending order of value).
                    </p>
                    <table className="brutalist-table" style={{ width: '100%', borderCollapse: 'collapse', border: '3px solid #000', marginBottom: '15px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#C25A3F', color: '#fff', borderBottom: '3px solid #000' }}>
                                <th style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'left', fontWeight: '800' }}>Token Type</th>
                                <th style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: '800' }}>Count</th>
                                <th style={{ padding: '6px', textAlign: 'left', fontWeight: '800' }}>Rupee Value (Top to Bottom)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>💎 Diamonds</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>6</td>
                                <td style={{ padding: '6px', fontFamily: 'monospace' }}>7, 7, 5, 5, 5, 5</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>🪙 Gold</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>6</td>
                                <td style={{ padding: '6px', fontFamily: 'monospace' }}>6, 6, 5, 5, 5, 5</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>🥈 Silver</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>6</td>
                                <td style={{ padding: '6px', fontFamily: 'monospace' }}>5, 5, 5, 5, 5, 5</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>🧵 Cloth</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>8</td>
                                <td style={{ padding: '6px', fontFamily: 'monospace' }}>5, 3, 3, 2, 2, 1, 1, 1</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>🌶️ Spice</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>8</td>
                                <td style={{ padding: '6px', fontFamily: 'monospace' }}>5, 3, 3, 2, 2, 1, 1, 1</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>👜 Leather</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>10</td>
                                <td style={{ padding: '6px', fontFamily: 'monospace' }}>4, 3, 2, 1, 1, 1, 1, 1, 1, 1</td>
                            </tr>
                            <tr style={{ backgroundColor: '#eee' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px' }}>🐫 Camel Token</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'center' }}>1</td>
                                <td style={{ padding: '6px' }}><strong>5</strong> (Awarded to player with strictly more camels)</td>
                            </tr>
                        </tbody>
                    </table>

                    <h4 style={{ marginTop: '15px', marginBottom: '8px' }}>Bonus Tokens</h4>
                    <p style={{ margin: 0 }}>
                        Selling multiple cards at once earns a random bonus token from the corresponding pile:
                    </p>
                    <ul>
                        <li><strong>3-Card Sale:</strong> Random bonus value between <strong>1 and 3</strong> rupees.</li>
                        <li><strong>4-Card Sale:</strong> Random bonus value between <strong>4 and 6</strong> rupees.</li>
                        <li><strong>5+ Card Sale:</strong> Random bonus value between <strong>8 and 10</strong> rupees.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Setup</h3>
                    <ul>
                        <li>The market starts with 3 camel cards face-up + 2 random cards drawn from the deck.</li>
                        <li>Each player receives 5 cards. Any camels in your starting hand are immediately placed in your personal <strong>herd</strong>.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>On Your Turn</h3>
                    <p>You must perform exactly <strong>one</strong> of the following actions:</p>
                    <ul>
                        <li><strong>Take 1 Single Good:</strong> Take any goods card from the market into your hand. The market is refilled from the deck. (Cannot be used to take camels).</li>
                        <li><strong>Take All Camels:</strong> Take all camels currently in the market and add them to your personal herd. Market refilled from the deck.</li>
                        <li><strong>Exchange Goods (Take Several):</strong> Take 2+ goods cards from the market and return the exact same number of cards from your hand (goods) and/or herd (camels).
                            <ul>
                                <li><strong>Constraint:</strong> Minimum exchange is 2-for-2.</li>
                                <li><strong>Constraint:</strong> You cannot exchange cards of the same type (e.g. take cloth and return cloth).</li>
                            </ul>
                        </li>
                        <li><strong>Sell Goods:</strong> Discard any number of cards of <strong>one</strong> goods type. Receive goods tokens from the top of the stack. If you sell 3, 4, or 5+ cards, draw the corresponding bonus token.
                            <ul>
                                <li><strong>Constraint:</strong> Selling expensive goods (Diamonds 💎, Gold 🪙, Silver 🥈) requires selling a minimum of 2 cards.</li>
                                <li><strong>Constraint:</strong> Cheap goods (Cloth 🧵, Spice 🌶️, Leather 👜) can be sold in single units.</li>
                            </ul>
                        </li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Hand Limit</h3>
                    <p>
                        At the end of your turn, you cannot have more than <strong>7 cards</strong> in your hand.
                        Camels in your herd do not count toward this limit.
                    </p>
                </div>

                <div className="rules-section">
                    <h3>Round Scoring & End</h3>
                    <p>A round ends immediately when:</p>
                    <ul>
                        <li>3 goods token stacks are empty, OR</li>
                        <li>The deck runs out of cards when refilling the market.</li>
                    </ul>
                    <p>Scoring steps:</p>
                    <ul>
                        <li>Player with strictly more camels in their herd gains the <strong>Camel Token (5 rupees)</strong>.</li>
                        <li>Players sum all their collected rupee tokens.</li>
                        <li>Richer player wins a Seal of Excellence. Ties broken by: most bonus tokens, then most goods tokens.</li>
                    </ul>
                </div>
            </div>
        );
    }
}

// Stats & Scores View
export interface JaipurStatsProps {
    roundNumber: number;
    seals: number;
    opponentSeals: number;
    roundResults: RoundResult[];
    playerNames: { [id: string]: string };
    MP: any;
    opponentId: string;
}

export class JaipurStatsView extends React.Component<JaipurStatsProps, {}> {
    public render() {
        const { roundResults, playerNames, MP, opponentId } = this.props;
        const myId = MP.clientId;

        return (
            <div className="jaipur-rules-panel jaipur-stats-panel">
                <h2>Score Board</h2>

                <div className="score-summary-grid">
                    <div className="brutalist-panel panel-turmeric">
                        <h4>You</h4>
                        <div style={{ fontSize: '1.8em', fontWeight: 800 }}>
                            🏅 x{this.props.seals}
                        </div>
                        <div style={{ fontSize: '0.85em', fontWeight: 600, textTransform: 'uppercase' }}>
                            Seals of Excellence
                        </div>
                    </div>
                    <div className="brutalist-panel panel-terracotta">
                        <h4>{playerNames[opponentId] || 'Opponent'}</h4>
                        <div style={{ fontSize: '1.8em', fontWeight: 800 }}>
                            🏅 x{this.props.opponentSeals}
                        </div>
                        <div style={{ fontSize: '0.85em', fontWeight: 600, textTransform: 'uppercase' }}>
                            Seals of Excellence
                        </div>
                    </div>
                </div>

                <h3>Round History</h3>
                {roundResults.length === 0 ? (
                    <p style={{ fontStyle: 'italic', color: '#7f8c8d' }}>No rounds played yet.</p>
                ) : (
                    roundResults.map((res, i) => {
                        const myScore = res.scores[myId];
                        const oppScore = res.scores[opponentId];
                        const wonSeal = res.winnerId === myId;
                        const lostSeal = res.winnerId === opponentId;

                        return (
                            <div key={i} className="round-log-card">
                                <h4>Round {res.roundNumber}</h4>
                                <div className="score-row">
                                    <span>Rupees earned:</span>
                                    <span>You: {myScore?.rupees} vs {playerNames[opponentId]}: {oppScore?.rupees}</span>
                                </div>
                                <div className="score-row">
                                    <span>Herd size (camels):</span>
                                    <span>You: {myScore?.camels} vs {playerNames[opponentId]}: {oppScore?.camels}</span>
                                </div>
                                <div className="score-row" style={{ marginTop: '5px', fontWeight: 800 }}>
                                    <span>Outcome:</span>
                                    {res.winnerId === null ? (
                                        <span style={{ color: '#7f8c8d' }}>TIED ROUND</span>
                                    ) : wonSeal ? (
                                        <span style={{ color: '#2E8B57' }}>WON SEAL 🏅</span>
                                    ) : (
                                        <span style={{ color: '#C25A3F' }}>LOST SEAL</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        );
    }
}

// Interface for props in JaipurMainProps
interface JaipurMainProps extends ViewPropsInterface {
    gameStatus: GameStatus;
    playerIds: string[];
    currentPlayerId: string;
    market: Card[];
    deckSize: number;
    discardPile: Card[];
    goodsTokens: { [key in CardType]?: number[] };
    bonusTokensSizes: { '3': number; '4': number; '5': number };
    camelTokenClaimedBy: string | null;
    winnerId: string | null;
    roundNumber: number;
    lastMove: MoveRecord | null;
    roundResults: RoundResult[];

    // Client personal state
    hand: Card[];
    herd: Card[];
    tokens: Token[];
    seals: number;
    rupeesThisRound: number;

    // Opponent public/private state
    opponentId: string;
    opponentHandSize: number;
    opponentHerdSize: number | null; // Private during play
    opponentTokensCount: number;
    opponentTokens: Token[];
    opponentSeals: number;
    opponentRupeesThisRound: number;

    isHost: boolean;
    playerNames: { [playerId: string]: string };
}

interface JaipurViewState {
    selectedMarketCardIds: number[];
    selectedHandCardIds: number[];
    selectedHerdCardIds: number[];

    // Animation state
    displayMarket: Card[];
    disappearingCardIds: number[];
    appearingCardIds: number[];
    isAnimating: boolean;
}

class JaipurArenaView extends React.Component<JaipurMainProps, JaipurViewState> {
    private animationTimeouts: number[] = [];

    constructor(props: JaipurMainProps) {
        super(props);
        this.state = {
            selectedMarketCardIds: [],
            selectedHandCardIds: [],
            selectedHerdCardIds: [],
            displayMarket: props.market || [],
            disappearingCardIds: [],
            appearingCardIds: [],
            isAnimating: false
        };
    }

    componentDidUpdate(prevProps: JaipurMainProps) {
        // Reset selections when turn change or status shift occurs
        if (prevProps.currentPlayerId !== this.props.currentPlayerId ||
            prevProps.gameStatus !== this.props.gameStatus) {
            this.setState({
                selectedMarketCardIds: [],
                selectedHandCardIds: [],
                selectedHerdCardIds: []
            });
        }

        // Handle animation state resetting or triggering
        if (prevProps.gameStatus !== this.props.gameStatus || this.props.gameStatus !== GameStatus.Active) {
            this.clearAllAnimationTimeouts();
            this.setState({
                displayMarket: this.props.market || [],
                disappearingCardIds: [],
                appearingCardIds: [],
                isAnimating: false
            });
        } else if (JSON.stringify(prevProps.market.map(c => c.id)) !== JSON.stringify(this.props.market.map(c => c.id))) {
            this.animateMarketTransition(prevProps.market || [], this.props.market || []);
        }
    }

    componentWillUnmount() {
        this.clearAllAnimationTimeouts();
    }

    private clearAllAnimationTimeouts() {
        this.animationTimeouts.forEach(t => window.clearTimeout(t));
        this.animationTimeouts = [];
    }

    private animateMarketTransition(oldMarket: Card[], newMarket: Card[]) {
        this.clearAllAnimationTimeouts();

        const oldIds = oldMarket.map(c => c.id);
        const newIds = newMarket.map(c => c.id);

        const removedCards = oldMarket.filter(c => !newIds.includes(c.id));
        const addedCards = newMarket.filter(c => !oldIds.includes(c.id));

        if (removedCards.length === 0 && addedCards.length === 0) {
            this.setState({
                displayMarket: newMarket,
                disappearingCardIds: [],
                appearingCardIds: [],
                isAnimating: false
            });
            return;
        }

        // Start animating removed cards out
        this.setState({
            displayMarket: [...oldMarket],
            disappearingCardIds: [],
            appearingCardIds: [],
            isAnimating: true
        });

        let delay = 0;
        removedCards.forEach((card) => {
            const timeoutId = window.setTimeout(() => {
                this.setState(prevState => ({
                    disappearingCardIds: [...prevState.disappearingCardIds, card.id]
                }));
            }, delay);
            this.animationTimeouts.push(timeoutId);
            delay += 300;
        });

        const disappearEndDelay = delay + 350; // Wait for the exit animation (350ms in CSS) to complete

        const transitionTimeoutId = window.setTimeout(() => {
            const retainedCards = oldMarket.filter(c => newIds.includes(c.id));
            this.setState({
                displayMarket: retainedCards,
                disappearingCardIds: []
            });

            let addDelay = 0;
            addedCards.forEach((card, index) => {
                const addTimeoutId = window.setTimeout(() => {
                    this.setState(prevState => {
                        const appearedAddedCards = addedCards.slice(0, index + 1);
                        const currentVisibleIds = [...retainedCards.map(c => c.id), ...appearedAddedCards.map(c => c.id)];
                        const currentDisplayMarket = newMarket.filter(c => currentVisibleIds.includes(c.id));

                        return {
                            displayMarket: currentDisplayMarket,
                            appearingCardIds: [...prevState.appearingCardIds, card.id]
                        };
                    });
                }, addDelay);
                this.animationTimeouts.push(addTimeoutId);
                addDelay += 300;
            });

            const finalTimeoutId = window.setTimeout(() => {
                this.setState({
                    displayMarket: newMarket,
                    appearingCardIds: [],
                    isAnimating: false
                });
            }, addDelay + 350);
            this.animationTimeouts.push(finalTimeoutId);

        }, disappearEndDelay);
        this.animationTimeouts.push(transitionTimeoutId);
    }

    private toggleMarketSelect(cardId: number) {
        if (this.state.isAnimating) return;
        const { market } = this.props;
        const card = market.find(c => c.id === cardId);
        if (!card) return;

        const currentSelected = [...this.state.selectedMarketCardIds];
        const idx = currentSelected.indexOf(cardId);

        if (idx > -1) {
            currentSelected.splice(idx, 1);
        } else {
            currentSelected.push(cardId);
        }

        this.setState({ selectedMarketCardIds: currentSelected });
    }

    private toggleHandSelect(cardId: number) {
        if (this.state.isAnimating) return;
        const currentSelected = [...this.state.selectedHandCardIds];
        const idx = currentSelected.indexOf(cardId);

        if (idx > -1) {
            currentSelected.splice(idx, 1);
        } else {
            currentSelected.push(cardId);
        }

        this.setState({ selectedHandCardIds: currentSelected });
    }

    private toggleHerdSelect(cardId: number) {
        if (this.state.isAnimating) return;
        const currentSelected = [...this.state.selectedHerdCardIds];
        const idx = currentSelected.indexOf(cardId);

        if (idx > -1) {
            currentSelected.splice(idx, 1);
        } else {
            currentSelected.push(cardId);
        }

        this.setState({ selectedHerdCardIds: currentSelected });
    }

    private handleTakeSingle() {
        if (this.state.isAnimating) return;
        const { selectedMarketCardIds } = this.state;
        if (selectedMarketCardIds.length === 1) {
            this.props.MP.takeSingleGood(selectedMarketCardIds[0]);
        }
    }

    private handleTakeAllCamels() {
        if (this.state.isAnimating) return;
        this.props.MP.takeAllCamels();
    }

    private handleExchange() {
        if (this.state.isAnimating) return;
        const { selectedMarketCardIds, selectedHandCardIds, selectedHerdCardIds } = this.state;
        const returnCards: { id: number; from: 'hand' | 'herd' }[] = [];
        for (const id of selectedHandCardIds) {
            returnCards.push({ id, from: 'hand' });
        }
        for (const id of selectedHerdCardIds) {
            returnCards.push({ id, from: 'herd' });
        }

        this.props.MP.exchangeGoods(selectedMarketCardIds, returnCards);
    }

    private handleSell() {
        if (this.state.isAnimating) return;
        const { selectedHandCardIds } = this.state;
        const { hand } = this.props;
        if (selectedHandCardIds.length === 0) return;

        // Determine type of the first selected card
        const firstCard = hand.find(c => c.id === selectedHandCardIds[0]);
        if (!firstCard) return;

        this.props.MP.sellGoods(firstCard.type, selectedHandCardIds);
    }

    render() {
        const {
            MP,
            gameStatus,
            currentPlayerId,
            market,
            deckSize,
            goodsTokens,
            bonusTokensSizes,
            hand,
            herd,
            tokens,
            seals,
            rupeesThisRound,
            opponentId,
            opponentHandSize,
            opponentHerdSize,
            opponentTokens,
            opponentSeals,
            opponentRupeesThisRound,
            playerNames,
            lastMove
        } = this.props;

        const myId = MP.clientId;
        const isMyTurn = myId === currentPlayerId;

        // Selections
        const {
            selectedMarketCardIds,
            selectedHandCardIds,
            selectedHerdCardIds,
            displayMarket,
            disappearingCardIds,
            appearingCardIds,
            isAnimating
        } = this.state;

        const getSalesSummary = (playerTokens: Token[]) => {
            const summary: { [key: string]: number } = {};
            (playerTokens || []).forEach(t => {
                summary[t.type] = (summary[t.type] || 0) + 1;
            });
            return summary;
        };

        const mySummary = getSalesSummary(tokens || []);
        const oppSummary = getSalesSummary(opponentTokens || []);

        const itemsToDisplay = [
            { key: 'diamonds', label: '💎 Diamonds' },
            { key: 'gold', label: '🪙 Gold' },
            { key: 'silver', label: '🥈 Silver' },
            { key: 'cloth', label: '🧵 Cloth' },
            { key: 'spice', label: '🌶️ Spice' },
            { key: 'leather', label: '👜 Leather' },
            { key: 'camel', label: '🐫 Camels' },
            { key: 'bonus3', label: '🎁 3-Card Bonus' },
            { key: 'bonus4', label: '🎁 4-Card Bonus' },
            { key: 'bonus5', label: '🎁 5+ Card Bonus' }
        ];

        // Helpers to validate buttons
        const isTakeSingleEnabled = isMyTurn && !isAnimating &&
            selectedMarketCardIds.length === 1 &&
            market.find(c => c.id === selectedMarketCardIds[0])?.type !== 'camels' &&
            hand.length < 7;

        const hasCamelsInMarket = market.some(c => c.type === 'camels');
        const isTakeCamelsEnabled = isMyTurn && !isAnimating && hasCamelsInMarket;

        const totalSelectedReturnCount = selectedHandCardIds.length + selectedHerdCardIds.length;

        // Exchange validation:
        // 1. Min 2 cards taken
        // 2. Exact same number returned
        // 3. No camels taken
        // 4. No matching card type taken and returned
        // 5. Hand size limit check
        let isExchangeEnabled = isMyTurn && !isAnimating &&
            selectedMarketCardIds.length >= 2 &&
            selectedMarketCardIds.length === totalSelectedReturnCount;

        if (isExchangeEnabled) {
            const takenCards = selectedMarketCardIds.map(id => market.find(c => c.id === id)!);
            const returnedCards = [
                ...selectedHandCardIds.map(id => hand.find(c => c.id === id)!),
                ...selectedHerdCardIds.map(id => herd.find(c => c.id === id)!)
            ];

            const takenTypes = new Set(takenCards.map(c => c.type));
            const returnedTypes = new Set(returnedCards.map(c => c.type));

            // Cannot take camels
            if (takenTypes.has('camels')) {
                isExchangeEnabled = false;
            }

            // Cannot exchange same types
            for (const type of returnedTypes) {
                if (takenTypes.has(type)) {
                    isExchangeEnabled = false;
                }
            }

            // Final hand size constraint check: hand.length + net change <= 7
            const netHandChange = takenCards.length - selectedHandCardIds.length;
            if (hand.length + netHandChange > 7) {
                isExchangeEnabled = false;
            }
        }

        // Sell validation:
        // 1. Must select at least 1 card in hand
        // 2. All selected cards must match same type (which is not camels)
        // 3. Expensive cards (Diamonds, Gold, Silver) require min 2 cards
        let isSellEnabled = isMyTurn && !isAnimating && selectedHandCardIds.length > 0;
        let sellCategory: CardType | null = null;

        if (isSellEnabled) {
            const sellCards = selectedHandCardIds.map(id => hand.find(c => c.id === id)!);
            const firstType = sellCards[0].type;
            sellCategory = firstType;

            const allSameType = sellCards.every(c => c.type === firstType);
            if (!allSameType || firstType === 'camels') {
                isSellEnabled = false;
            } else {
                const isExpensive = firstType === 'diamonds' || firstType === 'gold' || firstType === 'silver';
                if (isExpensive && sellCards.length < 2) {
                    isSellEnabled = false;
                }
                // Check if stack is empty
                const stack = goodsTokens[firstType] || [];
                if (stack.length === 0) {
                    isSellEnabled = false;
                }
            }
        }

        return (
            <div className="jaipur-arena-container">
                {/* 1. Opponent Info Bar */}
                <div className="opp-dashboard">
                    <div className="opp-profile">
                        👤 {playerNames[opponentId] || 'Opponent'}
                        {opponentId === currentPlayerId && <span style={{ color: '#F4C430', fontSize: '0.8em' }}>◀ ACTIVE</span>}
                    </div>
                    <div className="opp-stats">
                        <span>🃏 x{opponentHandSize}</span>
                        <span>🐫 x{opponentHerdSize !== null ? opponentHerdSize : '?'}</span>
                        <span>🏅 x{opponentSeals}</span>
                    </div>
                </div>

                {/* 2. Turn Status Bar */}
                <div style={{
                    backgroundColor: isMyTurn ? '#F4C430' : '#FFFFFF',
                    border: '3px solid #000',
                    boxShadow: '3px 3px 0px #000',
                    fontWeight: 800,
                    fontSize: '1em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                }}>
                    {lastMove && (
                        <div style={{
                            fontSize: '0.9em',
                            color: '#C25A3F',
                            borderBottom: '1px solid rgba(0,0,0,0.15)',
                            paddingBottom: '6px',
                            marginBottom: '4px',
                            textTransform: 'none'
                        }}>
                            📢 <strong>{playerNames[lastMove.playerId] || lastMove.playerId}</strong> {lastMove.desc}
                        </div>
                    )}
                    <div>
                        {isMyTurn ? (
                            <span>Your Turn - Select cards in market or hand</span>
                        ) : (
                            <span>Waiting for <strong>{playerNames[currentPlayerId]}</strong>...</span>
                        )}
                    </div>
                </div>

                {/* 3. Market Area */}
                <div className="brutalist-panel market-zone">
                    <div className="market-label-row">
                        <h4 style={{ margin: 0 }}>Market</h4>
                        <span className="deck-badge">🎴 Deck: {deckSize}</span>
                    </div>
                    <div className="market-cards">
                        {displayMarket.map(card => {
                            const isTakeSelected = selectedMarketCardIds.includes(card.id);
                            const isDisappearing = disappearingCardIds.includes(card.id);
                            const isAppearing = appearingCardIds.includes(card.id);

                            let animClass = '';
                            if (isDisappearing) {
                                animClass = 'anim-disappearing';
                            } else if (isAppearing) {
                                animClass = 'anim-appearing';
                            }

                            return (
                                <div
                                    key={card.id}
                                    className={`jaipur-card card-${card.type} ${isTakeSelected ? 'selected-take' : ''} ${animClass}`}
                                    onClick={() => this.toggleMarketSelect(card.id)}
                                >
                                    <span className="card-top-icon">{goodsEmoji(card.type)}</span>
                                    <span className="card-center-emoji">{goodsEmoji(card.type)}</span>
                                    <span className="card-name-label">{goodsLabel(card.type)}</span>
                                </div>
                            );
                        })}
                    </div>
                    {/* Market Actions (Take Good & Take Camels) */}
                    <div className="market-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
                        <button
                            className="brutalist-button btn-turmeric"
                            disabled={!isTakeSingleEnabled}
                            onClick={() => this.handleTakeSingle()}
                            style={{ flex: '1', maxWidth: '200px' }}
                        >
                            Take Good
                        </button>
                        <button
                            className="brutalist-button btn-emerald"
                            disabled={!isTakeCamelsEnabled}
                            onClick={() => this.handleTakeAllCamels()}
                            style={{ flex: '1', maxWidth: '200px' }}
                        >
                            Take Camels
                        </button>
                    </div>
                </div>

                <div className="board-middle-row">
                    {/* 5. Player Hand and Herd (Left / Top) */}
                    <div className="brutalist-panel player-dashboard" style={{ marginBottom: 0 }}>
                        <div className="herd-row">
                            <span>Herds: 🐫 x{herd.length}</span>
                            <div className="herd-list">
                                {herd.map(card => {
                                    const isReturnSelected = selectedHerdCardIds.includes(card.id);
                                    return (
                                        <div
                                            key={card.id}
                                            className={`herd-item-camels ${isReturnSelected ? 'selected-return' : ''}`}
                                            onClick={() => this.toggleHerdSelect(card.id)}
                                        >
                                            🐫
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="hand-row">
                            <h3>
                                Your Hand
                                <span style={{ fontSize: '0.8em', color: '#555' }}>
                                    (🃏 {hand.length}/7)
                                </span>
                            </h3>
                            <div className="hand-cards">
                                {hand.length === 0 ? (
                                    <div style={{ padding: '15px', color: '#7f8c8d', fontStyle: 'italic', fontSize: '0.9em' }}>
                                        Empty Hand
                                    </div>
                                ) : (
                                    hand.map(card => {
                                        const isReturnSelected = selectedHandCardIds.includes(card.id);
                                        const isSellSelected = isSellEnabled && selectedHandCardIds.includes(card.id);

                                        let highlightClass = '';
                                        if (isReturnSelected) highlightClass = 'selected-return';
                                        if (isSellSelected) highlightClass = 'selected-sell';

                                        return (
                                            <div
                                                key={card.id}
                                                className={`jaipur-card card-${card.type} ${highlightClass}`}
                                                onClick={() => this.toggleHandSelect(card.id)}
                                            >
                                                <span className="card-top-icon">{goodsEmoji(card.type)}</span>
                                                <span className="card-center-emoji">{goodsEmoji(card.type)}</span>
                                                <span className="card-name-label">{goodsLabel(card.type)}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Interactive Buttons dashboard */}
                        <div className="actions-panel">
                            <button
                                className="brutalist-button btn-terracotta"
                                disabled={!isExchangeEnabled}
                                onClick={() => this.handleExchange()}
                            >
                                Exchange ({selectedMarketCardIds.length} ⇆ {totalSelectedReturnCount})
                            </button>
                            <button
                                className="brutalist-button btn-indigo"
                                disabled={!isSellEnabled}
                                onClick={() => this.handleSell()}
                            >
                                Sell {sellCategory ? goodsLabel(sellCategory) : ''}
                            </button>
                        </div>
                    </div>

                    {/* 4. Token Stacks (Right / Bottom) */}
                    <div className="brutalist-panel tokens-stacks-container">
                        <h3 style={{ borderBottom: '3px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>Rupee Tokens</h3>
                        <div className="tokens-grid">
                            {(['diamonds', 'gold', 'silver', 'cloth', 'spice', 'leather'] as CardType[]).map(type => {
                                const list = goodsTokens[type] || [];
                                const topVal = list.length > 0 ? list[0] : 0;

                                return (
                                    <div key={type} className={`token-stack-card stack-${type}`}>
                                        <span>{goodsEmoji(type)} {goodsLabel(type)}</span>
                                        {list.length > 0 ? (
                                            <span className="token-stack-visual">{topVal}</span>
                                        ) : (
                                            <span style={{ color: '#7f8c8d', fontSize: '0.8em' }}>EMPTY</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', fontWeight: 'bold' }}>
                            <span>🎁 Bonus (3/4/5+):</span>
                            <span>{bonusTokensSizes['3']} / {bonusTokensSizes['4']} / {bonusTokensSizes['5']} left</span>
                        </div>
                    </div>
                </div>

                {/* Score summary this round for player - Tableau of Sales & Rupees */}
                <div className="brutalist-panel panel-turmeric" style={{ marginTop: '10px', padding: '12px' }}>
                    <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid #000', paddingBottom: '6px', textAlign: 'left' }}>
                        Round Sales & Earnings
                    </h4>
                    <table className="brutalist-table" style={{ width: '100%', borderCollapse: 'collapse', border: '3px solid #000', fontSize: '0.85em', textAlign: 'center', backgroundColor: '#fff' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#F4C430', borderBottom: '3px solid #000', fontWeight: 800 }}>
                                <th style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'left' }}>Item / Token Type</th>
                                <th style={{ borderRight: '2px solid #000', padding: '6px' }}>You</th>
                                <th style={{ padding: '6px' }}>{playerNames[opponentId] || 'Opponent'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemsToDisplay.map((item, idx) => {
                                const myCount = mySummary[item.key] || 0;
                                const oppCount = oppSummary[item.key] || 0;

                                // Only show rows where at least one player has a token to keep the table compact
                                if (myCount === 0 && oppCount === 0) return null;

                                return (
                                    <tr key={item.key} style={{ borderBottom: '2px solid #000' }}>
                                        <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'left', fontWeight: 600 }}>{item.label}</td>
                                        <td style={{ borderRight: '2px solid #000', padding: '6px', fontWeight: 700 }}>{myCount}</td>
                                        <td style={{ padding: '6px', fontWeight: 700 }}>{oppCount}</td>
                                    </tr>
                                );
                            })}
                            <tr style={{ fontWeight: 800, backgroundColor: '#f9f9f9', borderTop: '1px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', textAlign: 'left' }}>💰 Rupees Earned</td>
                                <td style={{ borderRight: '2px solid #000', padding: '6px', fontSize: '1.1em', color: '#2E8B57' }}>{rupeesThisRound}</td>
                                <td style={{ padding: '6px', fontSize: '1.1em', color: '#C25A3F' }}>{opponentRupeesThisRound}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

// Main coordinator page combining tabs and shells
export class JaipurMainPage extends React.Component<ViewPropsInterface & JaipurMainProps, {}> {
    public render() {
        const mp = this.props.MP;
        const { gameStatus, winnerId, roundNumber, playerNames, opponentId, rupeesThisRound, opponentRupeesThisRound, seals, opponentSeals, roundResults } = this.props;

        // Full screen overlay for Round End
        if (gameStatus === GameStatus.RoundEnd) {
            const lastResult = roundResults[roundResults.length - 1];
            const isHost = this.props.isHost;

            return mp.getPluginView(
                'gameshell',
                'HostShell-Main',
                {
                    'gameName': `Round ${roundNumber} Over`,
                    'links': {
                        'home': {
                            'icon': 'trophy',
                            'label': 'Round Outcome',
                            'view': (
                                <div className="jaipur-game-over-container">
                                    <div className="trophy-visual">⚖️</div>
                                    <h2>Round {roundNumber} Complete!</h2>

                                    <div className="scores-card">
                                        <div className="score-item">
                                            <span>Rupees You:</span>
                                            <span>{rupeesThisRound}</span>
                                        </div>
                                        <div className="score-item">
                                            <span>Rupees {playerNames[opponentId] || 'Opponent'}:</span>
                                            <span>{opponentRupeesThisRound}</span>
                                        </div>
                                        {lastResult && (
                                            <div style={{ fontSize: '0.9em', color: '#555', marginTop: '10px', textAlign: 'left' }}>
                                                <div>🐪 Camel winner: {lastResult.camelTokenWinner ? playerNames[lastResult.camelTokenWinner] : 'None (tied)'} (+5 rupees)</div>
                                                <div style={{ fontWeight: 800, color: '#C25A3F', marginTop: '5px' }}>
                                                    🏆 Round Seal Awarded To: {lastResult.winnerId ? playerNames[lastResult.winnerId] : 'No one (tied)'}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="btn-actions">
                                        {isHost ? (
                                            <button
                                                className="brutalist-button btn-turmeric"
                                                onClick={() => mp.nextRound()}
                                            >
                                                Start Next Round
                                            </button>
                                        ) : (
                                            <div className="brutalist-panel panel-indigo">
                                                Waiting for Host to start next round...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        },
                        'stats': {
                            'icon': 'trophy',
                            'label': 'Scores',
                            'view': <JaipurStatsView {...this.props} />
                        }
                    }
                }
            );
        }

        // Full screen overlay for Game Over
        if (gameStatus === GameStatus.GameOver) {
            const isHost = this.props.isHost;
            const wonGame = winnerId === mp.clientId;

            return mp.getPluginView(
                'gameshell',
                'HostShell-Main',
                {
                    'gameName': 'Game Over',
                    'links': {
                        'home': {
                            'icon': 'trophy',
                            'label': 'Winner Board',
                            'view': (
                                <div className="jaipur-game-over-container">
                                    <div className="trophy-visual">🏆</div>
                                    <h2>{wonGame ? 'You Won the Game!' : `${playerNames[winnerId || ''] || 'Opponent'} Wins!`}</h2>

                                    <div className="scores-card">
                                        <div className="score-item">
                                            <span>Final Seals You:</span>
                                            <span>🏅 x{seals}</span>
                                        </div>
                                        <div className="score-item">
                                            <span>Final Seals {playerNames[opponentId] || 'Opponent'}:</span>
                                            <span>🏅 x{opponentSeals}</span>
                                        </div>
                                    </div>

                                    <div className="btn-actions">
                                        {isHost ? (
                                            <>
                                                <button
                                                    className="brutalist-button btn-turmeric"
                                                    onClick={() => mp.restartGame()}
                                                >
                                                    Play Again
                                                </button>
                                                <button
                                                    className="brutalist-button btn-terracotta"
                                                    onClick={() => mp.backToLobby()}
                                                >
                                                    Back to Lobby
                                                </button>
                                            </>
                                        ) : (
                                            <div className="brutalist-panel panel-indigo">
                                                Waiting for Host to restart...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        },
                        'stats': {
                            'icon': 'trophy',
                            'label': 'Scores',
                            'view': <JaipurStatsView {...this.props} />
                        }
                    }
                }
            );
        }

        // Standard active board layout
        const links = {
            'home': {
                'icon': 'gamepad',
                'label': 'Arena',
                'view': <JaipurArenaView {...this.props} />
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <JaipurRulesView />
            },
            'stats': {
                'icon': 'trophy',
                'label': 'Scores',
                'view': <JaipurStatsView {...this.props} />
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Settings',
                'view': (
                    <div className="jaipur-rules-panel" style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <h3>Game Settings</h3>
                        <button className="brutalist-button btn-turmeric" onClick={() => mp.restartGame()}>Restart Game</button>
                        <button className="brutalist-button btn-terracotta" onClick={() => mp.backToLobby()}>Back to Lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': links,
                'gameName': 'Jaipur',
                'topBarContent': `🏅 x${seals} | Round ${roundNumber}`
            }
        );
    }
}
