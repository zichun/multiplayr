/**
 * DurianViews.tsx - React components for Durian game views
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { DurianGameRules } from './DurianRules';
import { GameStatus, PlacedOrder, Card } from '../DurianGameState';

// Emojis mapping for premium visuals
const FRUIT_EMOJIS = {
    banana: '🍌',
    grape: '🍇',
    strawberry: '🍓',
    durian: '🍈'
};



// Lobby Views
export class DurianHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'home',
                        'label': 'Lobby',
                        'view': mp.getPluginView('lobby', 'SetNameWithLobby')
                    },
                    'clients': {
                        'icon': 'users',
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': DurianGameRules
                    }
                },
                'gameName': 'Durian'
            }
        );
    }
}

export class DurianClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'id-card',
                        'label': 'Lobby',
                        'view': mp.getPluginView('lobby', 'SetNameWithLobby')
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': DurianGameRules
                    }
                },
                'gameName': 'Durian'
            });
    }
}

// Main Game Page View
interface DurianMainViewProps extends ViewPropsInterface {
    isHost: boolean;
    gameStatus: GameStatus;
    round: number;
    currentPlayerId: string;
    lastPlayerId: string | null;
    players: { [playerId: string]: { id: string; points: number; inventoryCard: Card | null } };
    orders: PlacedOrder[];
    deckCount: number;
    drawnCard: Card | null;
    bellRingerId: string | null;
    resolutionDetails: any;
    // Names, accents, icons from Lobby
    lobby: {
        clientIds: string[];
        names: string[];
        accents: string[];
        icons: number[];
    };
}

export class DurianMainPage extends React.Component<DurianMainViewProps, {}> {
    public render() {
        const mp = this.props.MP;
        const currentView = this.renderCurrentView();

        const links = {
            'home': {
                'icon': 'gamepad',
                'label': 'Play',
                'view': currentView
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': DurianGameRules
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Settings',
                'view': (
                    <div className="durian-settings">
                        <h3>Game Controls</h3>
                        <button className="durian-btn action-btn danger" onClick={() => this.props.MP.restartGame()}>
                            Restart Game 🔄
                        </button>
                        <button className="durian-btn action-btn secondary" onClick={() => this.props.MP.backToLobby()}>
                            Back to Lobby 🚪
                        </button>
                    </div>
                )
            };
        }

        const myPlayerState = this.props.players[mp.clientId];
        const myPoints = myPlayerState ? myPlayerState.points : 0;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': links,
                'gameName': '',
                'topBarContent': (
                    <span>
                        {myPoints > 0 ? '😡 ' + myPoints : '☺️'}
                    </span>
                )
            }
        );
    }

    private renderCurrentView() {
        switch (this.props.gameStatus) {
            case GameStatus.PlayerTurn:
            case GameStatus.CardDrawn:
                return <DurianGameBoard {...this.props} />;
            case GameStatus.ManagerResolution:
                return <DurianManagerResolution {...this.props} />;
            default:
                return <div>Unknown game status</div>;
        }
    }
}

interface DurianOrderBoardProps {
    orders: PlacedOrder[];
}

const DurianOrderBoard: React.FC<DurianOrderBoardProps> = ({ orders }) => {
    return (
        <div className="durian-layout-section order-board-section">
            <div className="order-clipboard">
                <div className="clipboard-clip"></div>
                <div className="clipboard-paper">
                    {orders.length === 0 ? (
                        <div className="no-orders">
                            <p>No active orders placed yet.</p>
                        </div>
                    ) : (
                        <div className="orders-scroller">
                            {orders.map((order, idx) => (
                                <div
                                    key={`order-${idx}`}
                                    className="order-ticket"
                                >
                                    <span className="fruit-tally">
                                        {FRUIT_EMOJIS[order.fruit].repeat(order.count)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface DurianInventoryStandProps {
    player: { id: string; points: number; inventoryCard: Card | null };
    clerk: { name: string; color: string; iconIdx?: number };
    isMe: boolean;
    forceReveal?: boolean;
    isCurrentTurn?: boolean;
    mp: any;
}

const DurianInventoryStand: React.FC<DurianInventoryStandProps> = ({
    player,
    clerk,
    isMe,
    forceReveal = false,
    isCurrentTurn = false,
    mp
}) => {
    const showBack = isMe && !forceReveal;
    const currentTurnGlow = isCurrentTurn ? 'active-clerk-glow' : '';
    const revealedClass = showBack ? '' : 'face-revealed';

    return (
        <div className={`inventory-stand-container ${revealedClass} ${currentTurnGlow}`}>
            <div className="wooden-stand-slot">
                {showBack ? (
                    /* YOUR CARD: Hidden to you, showing card back */
                    <div className="fruit-card card-back">
                        <div className="card-inner">
                            <span className="mysterious-mark">?</span>
                        </div>
                    </div>
                ) : (
                    /* OPPONENT CARD or REVEALED CARD: Visible */
                    player.inventoryCard ? (
                        <div className="fruit-card face-up double-sided">
                            <div className="card-inner split">
                                <div className="card-side-a">
                                    <span className="visible-fruit">
                                        {FRUIT_EMOJIS[player.inventoryCard.sideA!.fruit].repeat(player.inventoryCard.sideA!.count)}
                                    </span>
                                </div>
                                <div className="card-divider"></div>
                                <div className="card-side-b">
                                    <span className="visible-fruit">
                                        {FRUIT_EMOJIS[player.inventoryCard.sideB!.fruit].repeat(player.inventoryCard.sideB!.count)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="fruit-card empty-card">Empty</div>
                    )
                )}
            </div>

            {/* Stand base plate containing player tag */}
            <div className="wooden-stand-base" style={{ borderTop: `6px solid ${clerk.color}` }}>
                <div className="stand-player-info">
                    {mp.getPluginView('lobby', 'player-tag', { clientId: player.id, border: false })}
                    <div className="player-chips">
                        <span className="penalty-chip">😡x{player.points}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 1. Durian Game Board View (Top Actions, Middle Orders, Bottom Stands)
class DurianGameBoard extends React.Component<DurianMainViewProps, {}> {
    constructor(props: DurianMainViewProps) {
        super(props);
    }

    private getPlayerDisplay(playerId: string) {
        const idx = this.props.lobby.clientIds.indexOf(playerId);
        if (idx === -1) return { name: playerId, color: '#999', iconIdx: 0 };
        return {
            name: this.props.lobby.names[idx],
            color: this.props.lobby.accents[idx] || '#2ecc71',
            iconIdx: this.props.lobby.icons[idx] || 0
        };
    }

    public render() {
        const mp = this.props.MP;
        const isMyTurn = mp.clientId === this.props.currentPlayerId;
        const activeClerk = this.getPlayerDisplay(this.props.currentPlayerId);

        return (
            <div className="durian-game-board">
                {/* 1. TOP LAYOUT: ACTION CONTROLS */}
                <div className="durian-layout-section action-section">
                    {isMyTurn ? (
                        <div className="active-turn-actions anim-fade-in">
                            <h4 className="turn-indicator pulse-glow">🟢 Your Turn! Make a Decision</h4>
                            {this.props.gameStatus === GameStatus.PlayerTurn && (
                                <div className="turn-choices">
                                    <button
                                        className="durian-btn action-btn draw-btn"
                                        onClick={() => mp.drawCard()}
                                    >
                                        🎴 Draw Order Card
                                    </button>
                                    <button
                                        className={`durian-btn action-btn bell-btn ${this.props.orders.length > 0 ? 'pulsing-bell' : 'disabled'}`}
                                        disabled={this.props.orders.length === 0}
                                        onClick={() => mp.ringBell()}
                                        title={this.props.orders.length === 0 ? "Cannot ring the bell on the first turn of the round" : ""}
                                    >
                                        🔔 Ring the Bell!
                                    </button>
                                </div>
                            )}

                            {this.props.gameStatus === GameStatus.CardDrawn && this.props.drawnCard && (
                                <div className="drawn-card-action card-resolution-action">
                                    <div className="fruit-choice-panel">
                                        <p className="instruction">Choose one side to place as an active customer order:</p>
                                        <div className="sides-choices">
                                            <div className="side-card-choice" onClick={() => mp.submitOrder('A')}>
                                                <span className="fruit-visual">{FRUIT_EMOJIS[this.props.drawnCard.sideA!.fruit].repeat(this.props.drawnCard.sideA!.count)}</span>
                                                <button className="durian-btn side-select-btn">👆</button>
                                            </div>
                                            <div className="side-separator">OR</div>
                                            <div className="side-card-choice" onClick={() => mp.submitOrder('B')}>
                                                <span className="fruit-visual">{FRUIT_EMOJIS[this.props.drawnCard.sideB!.fruit].repeat(this.props.drawnCard.sideB!.count)}</span>
                                                <button className="durian-btn side-select-btn">👆</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="waiting-turn-panel">
                            <h4 className="waiting-indicator">
                                ⏳ Waiting for <strong style={{ color: activeClerk.color }}>{activeClerk.name}</strong> to make a move...
                            </h4>
                            <p className="sub-text">
                                {this.props.gameStatus === GameStatus.CardDrawn
                                    ? 'They are resolving a drawn card...'
                                    : 'They are choosing to draw or ring the manager\'s bell.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* 2. MIDDLE LAYOUT: ORDER BOARD & RUNNING TOTALS */}
                <DurianOrderBoard orders={this.props.orders} />

                {/* 3. BOTTOM LAYOUT: INVENTORY STANDS */}
                <div className="durian-layout-section player-stands-section">
                    <h3>🏪 Inventory Stands</h3>
                    <div className="stands-grid">
                        {Object.values(this.props.players).map(player => {
                            const isMe = player.id === mp.clientId;
                            const clerk = this.getPlayerDisplay(player.id);
                            return (
                                <DurianInventoryStand
                                    key={player.id}
                                    player={player}
                                    clerk={clerk}
                                    isMe={isMe}
                                    isCurrentTurn={player.id === this.props.currentPlayerId}
                                    mp={mp}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }
}

// 2. Manager Confrontation View (Resolution Ledger screen)
class DurianManagerResolution extends React.Component<DurianMainViewProps, {}> {
    private getPlayerDisplay(playerId: string) {
        const idx = this.props.lobby.clientIds.indexOf(playerId);
        if (idx === -1) return { name: playerId, color: '#999' };
        return {
            name: this.props.lobby.names[idx],
            color: this.props.lobby.accents[idx] || '#2ecc71'
        };
    }

    public render() {
        const mp = this.props.MP;
        const details = this.props.resolutionDetails;
        if (!details) return <div className="loading">Confronting the manager...</div>;

        const penalized = this.getPlayerDisplay(details.penalizedPlayerId);
        const ringer = this.getPlayerDisplay(this.props.bellRingerId!);

        return (
            <div className="manager-resolution-scene anim-fade-in">
                <div className="gorilla-angry-banner anim-slide-down">
                    <h2>🦍 GRRR! The Manager has Arrived!</h2>
                    <p className="subtitle">All clerk inventories are flipped around for stock verification!</p>
                </div>


                {/* Confrontation Result Dashboard */}
                <div className="confrontation-dashboard glassmorphic-panel text-center">
                    <div className="verdict-bubble">
                        {details.success ? (
                            <div className="verdict-success">
                                <h3 className="text-green">Sufficient Inventory!</h3>
                                <p>
                                    Clerk <strong style={{ color: ringer.color }}>{ringer.name}</strong> rang the bell unnecessarily!
                                    The inventory was perfectly fine.
                                </p>
                            </div>
                        ) : (
                            <div className="verdict-failure">
                                <h3 className="text-red">EXCEEDED! Shortage Crisis!</h3>
                                <p>
                                    We did not have enough fruit stock! The culprit is the clerk who placed the last order.
                                </p>
                            </div>
                        )}
                    </div>

                    {this.props.isHost && (
                        <div className="host-resolution-actions">
                            <button className="durian-btn action-btn next-round-btn font-bold pulse-glow" onClick={() => mp.nextRound()}>
                                Next Round 🚀
                            </button>
                        </div>
                    )}
                </div>

                <DurianOrderBoard orders={this.props.orders} />

                {/* Display revealed stands at the bottom */}
                <div className="player-stands-section">
                    <h3>🏪 Inventory Stands</h3>
                    <div className="stands-grid font-small">
                        {Object.values(this.props.players).map(player => {
                            const clerk = this.getPlayerDisplay(player.id);
                            return (
                                <DurianInventoryStand
                                    key={player.id}
                                    player={player}
                                    clerk={clerk}
                                    isMe={player.id === mp.clientId}
                                    forceReveal={true}
                                    mp={mp}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }
}

// 3. Durian Game Over View (Winner Celebrations)
class DurianGameOver extends React.Component<DurianMainViewProps, {}> {
    private getPlayerDisplay(playerId: string) {
        const idx = this.props.lobby.clientIds.indexOf(playerId);
        if (idx === -1) return { name: playerId, color: '#999' };
        return {
            name: this.props.lobby.names[idx],
            color: this.props.lobby.accents[idx] || '#2ecc71'
        };
    }

    public render() {
        const mp = this.props.MP;

        // Calculate scores and determine winner (lowest points)
        const playersList = Object.values(this.props.players).map(p => {
            const display = this.getPlayerDisplay(p.id);
            return {
                id: p.id,
                name: display.name,
                color: display.color,
                points: p.points
            };
        });

        // Sort ascending (lowest points first)
        playersList.sort((a, b) => a.points - b.points);
        const winner = playersList[0];

        return (
            <div className="durian-game-over-container text-center anim-fade-in">
                <div className="victory-celebration anim-bounce">
                    <h2>🏆 The Audit is Complete! 🏆</h2>
                    <p className="subtitle">One of our clerks reached 7 penalty points, ending the shift!</p>
                </div>

                <div className="winner-podium glassmorphic-panel">
                    <span className="crown">👑</span>
                    <h3>Outstanding Clerk of the Month</h3>
                    <div className="winner-tag pulse-glow" style={{ backgroundColor: winner.color }}>
                        {winner.name}
                    </div>
                    <p className="score">with only <strong>{winner.points}</strong> Angry Manager penalty points!</p>
                </div>

                <div className="final-leaderboard glassmorphic-panel">
                    <h3>📋 Shift Performance Ledger</h3>
                    <div className="leaderboard-list">
                        {playersList.map((p, idx) => (
                            <div key={p.id} className="leaderboard-item">
                                <span className="rank font-bold">#{idx + 1}</span>
                                <span className="name" style={{ color: p.color }}>{p.name}</span>
                                <span className="score font-bold">{p.points} penalty points</span>
                            </div>
                        ))}
                    </div>
                </div>

                {this.props.isHost && (
                    <div className="game-over-host-actions">
                        <button className="durian-btn action-btn next-round-btn pulse-glow" onClick={() => mp.restartGame()}>
                            Play Another Shift! 🏪
                        </button>
                        <button className="durian-btn action-btn secondary" onClick={() => mp.backToLobby()}>
                            Return to Lobby 🚪
                        </button>
                    </div>
                )}
            </div>
        );
    }
}
