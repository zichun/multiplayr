/**
 * SplendorDuelViews.tsx - React components for Splendor Duel
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { GameStatus, Card, RoyalCard, TokenColor, ActionPhase } from '../SplendorDuelGameState';

// Helper to map token colors to Emojis (icon-replacement ONLY)
export const tokenEmoji = (color: TokenColor | 'wild'): string => {
    switch (color) {
        case 'blue': return '🔷';   // Sapphire
        case 'white': return '⚪';  // Diamond / Pearl White
        case 'green': return '💚';  // Emerald
        case 'black': return '🖤';  // Onyx
        case 'red': return '❤️';    // Ruby
        case 'pearl': return '🦪';  // Pearl
        case 'gold': return '🪙';   // Gold
        case 'wild': return '🌈';   // Joker / Wild
        default: return '❓';
    }
};

export const colorName = (color: TokenColor | 'wild'): string => {
    switch (color) {
        case 'blue': return 'Sapphire';
        case 'white': return 'Diamond';
        case 'green': return 'Emerald';
        case 'black': return 'Onyx';
        case 'red': return 'Ruby';
        case 'pearl': return 'Pearl';
        case 'gold': return 'Gold';
        case 'wild': return 'Joker';
        default: return '';
    }
};

// Colors for background styling
export const getBgColor = (color: TokenColor | 'wild' | null | undefined): string => {
    switch (color) {
        case 'blue': return '#1a5fb4';
        case 'white': return '#e1e1e1';
        case 'green': return '#2ec27e';
        case 'black': return '#241f31';
        case 'red': return '#e01b24';
        case 'pearl': return '#fce8c3';
        case 'gold': return '#f6d32d';
        case 'wild': return 'linear-gradient(135deg, #e01b24, #1a5fb4, #2ec27e, #f6d32d)';
        default: return '#5e5c64'; // Gray for null/points-only
    }
};

export const getTextColor = (color: TokenColor | 'wild' | null | undefined): string => {
    if (color === 'white' || color === 'pearl' || color === 'gold') {
        return '#000000';
    }
    return '#ffffff';
};

// Lobby Views
export class SplendorDuelHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1; // Host + clients

        const links = {
            'home': {
                'icon': 'home',
                'label': 'Lobby',
                'view': (
                    <div className="splendor-rules-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
                        <h2>Splendor Duel Lobby</h2>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                            {playerCount !== 2 ? (
                                <p style={{ color: '#e01b24', fontWeight: 'bold', fontSize: '0.9em', textAlign: 'center' }}>
                                    ⚠️ Splendor Duel is strictly a 2-player game. Currently {playerCount} player(s) in lobby.
                                </p>
                            ) : (
                                <button 
                                    className="brutalist-button start-btn"
                                    onClick={() => mp.startGame()}
                                >
                                    Start Game ⚔️
                                </button>
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
                'view': <SplendorDuelRulesView />
            }
        };

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'gameName': 'SplendorDuel',
                'links': links
            }
        );
    }
}

export class SplendorDuelClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        const links = {
            'home': {
                'icon': 'id-card',
                'label': 'Lobby',
                'view': (
                    <div className="splendor-rules-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
                        <h2>Splendor Duel Lobby</h2>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div style={{
                            backgroundColor: '#f6d32d',
                            color: '#000',
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
                'view': <SplendorDuelRulesView />
            }
        };

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'gameName': 'SplendorDuel',
                'links': links
            }
        );
    }
}

// Rules Reference View
export class SplendorDuelRulesView extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="splendor-rules-panel" style={{ padding: '20px', overflowY: 'auto', maxHeight: '80vh' }}>
                <div className="rules-section" style={{ marginBottom: '20px' }}>
                    <h3>Three Ways to Win 🏆</h3>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                        <li><strong>Condition 1:</strong> Acquire <strong>20+ total Prestige points</strong>.</li>
                        <li><strong>Condition 2:</strong> Collect <strong>10+ Crowns</strong> (crowns are printed on some Jewel cards).</li>
                        <li><strong>Condition 3:</strong> Accumulate <strong>10+ Prestige points</strong> on cards of a <strong>single color</strong> (wild/jokers count as their assigned color; gray cards without bonuses do not count).</li>
                    </ul>
                </div>

                <div className="rules-section" style={{ marginBottom: '20px' }}>
                    <h3>On Your Turn 🔄</h3>
                    <p>Optionally perform actions 1 & 2 (in order), then perform exactly ONE mandatory action:</p>
                    <ol style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                        <li><strong>[Optional] Use Privilege:</strong> Spend a scroll to take 1 non-gold token from the board.</li>
                        <li><strong>[Optional] Replenish Board:</strong> Refill empty board spaces from the bag (opponent gets 1 Privilege).</li>
                        <li><strong>[Mandatory A] Take Tokens:</strong> Take up to 3 adjacent Gem/Pearl tokens forming an uninterrupted straight line (no gold, no empty spaces between them). Taking 3 same-colored or 2 pearls gives your opponent 1 Privilege.</li>
                        <li><strong>[Mandatory B] Reserve + Gold:</strong> Take 1 Gold token from the board and reserve 1 card (pyramid or blind draw). Max 3 reserved cards.</li>
                        <li><strong>[Mandatory C] Purchase Card:</strong> Pay the token cost (reduced by bonuses of matching colors). Gold acts as a wild color.</li>
                    </ol>
                </div>

                <div className="rules-section" style={{ marginBottom: '20px' }}>
                    <h3>Card Abilities (Immediate) ✨</h3>
                    <table className="brutalist-table" style={{ width: '100%', borderCollapse: 'collapse', border: '3px solid #000' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f6d32d', borderBottom: '3px solid #000', color: '#000' }}>
                                <th style={{ borderRight: '2px solid #000', padding: '8px', textAlign: 'left' }}>Ability</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Effect</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '8px', fontWeight: 'bold' }}>Extra Turn</td>
                                <td style={{ padding: '8px' }}>Take another full turn immediately after this turn ends.</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '8px', fontWeight: 'bold' }}>Take Matching</td>
                                <td style={{ padding: '8px' }}>Take 1 token from the board matching this card&apos;s bonus color.</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '8px', fontWeight: 'bold' }}>Steal</td>
                                <td style={{ padding: '8px' }}>Take 1 gem or pearl token from your opponent (cannot steal gold).</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                                <td style={{ borderRight: '2px solid #000', padding: '8px', fontWeight: 'bold' }}>Privilege</td>
                                <td style={{ padding: '8px' }}>Gain 1 Privilege scroll (steal one from opponent if pool is empty).</td>
                            </tr>
                            <tr>
                                <td style={{ borderRight: '2px solid #000', padding: '8px', fontWeight: 'bold' }}>Joker / Wild</td>
                                <td style={{ padding: '8px' }}>Assign permanently to copy one of your existing owned bonus colors. Must own a bonus card to buy.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

interface SplendorDuelProps extends ViewPropsInterface {
    gameStatus: any;
    actionPhase: any;
    playerIds: string[];
    currentPlayerId: string;
    board: (TokenColor | null)[][];
    bagSize: number;
    deckSizes: { '1': number; '2': number; '3': number };
    pyramid: {
        1: (Card | null)[];
        2: (Card | null)[];
        3: (Card | null)[];
    };
    royalsPool: RoyalCard[];
    privilegesAboveBoard: number;
    winnerId: string | null;
    lastMove: {
        playerId: string;
        desc: string;
        moveId: number;
    } | null;
    pendingAbilityInfo: {
        ability: 'take_matching' | 'steal';
        cardId: string;
        targetColor?: TokenColor;
    } | null;
    pendingRoyalCount: number;

    // Personal state
    tokens: Record<TokenColor, number>;
    cards: Card[];
    royals: RoyalCard[];
    reserved: Card[];
    privileges: number;
    prestige: number;
    crowns: number;
    bonuses: Record<TokenColor, number>;
    isStuck: boolean;

    // Opponent state
    opponentId: string;
    opponentTokens: Record<TokenColor, number>;
    opponentCards: Card[];
    opponentRoyals: RoyalCard[];
    opponentReservedCount: number;
    opponentPrivileges: number;
    opponentPrestige: number;
    opponentCrowns: number;
    opponentBonuses: Record<TokenColor, number>;

    isHost: boolean;
    playerNames: Record<string, string>;
}

interface MainPageState {
    selectedCells: [number, number][]; // coordinates selected on the board
    selectedGoldCoord: [number, number] | null; // coordinate of selected Gold token
    selectedJokerCardId: string | null; // card id being purchased that is wild
    selectedJokerColor: TokenColor | null; // assigned color for joker card
    isPrivilegeMode: boolean; // true if player clicked "Use Privilege" and is selecting a token
    discardSelections: TokenColor[]; // tokens selected for discard
}

export class SplendorDuelMainPage extends React.Component<SplendorDuelProps, MainPageState> {
    constructor(props: SplendorDuelProps) {
        super(props);
        this.state = {
            selectedCells: [],
            selectedGoldCoord: null,
            selectedJokerCardId: null,
            selectedJokerColor: null,
            isPrivilegeMode: false,
            discardSelections: []
        };
    }

    // Toggle board cell selection
    private handleCellClick(r: number, c: number, token: TokenColor | null) {
        const mp = this.props.MP;
        const { currentPlayerId, actionPhase, pendingAbilityInfo } = this.props;

        if (currentPlayerId !== mp.myId) return;

        // 1. Privilege scroll spend mode
        if (this.state.isPrivilegeMode) {
            if (!token) return;
            if (token === 'gold') {
                alert('Cannot take Gold with a Privilege scroll');
                return;
            }
            mp.usePrivilege([r, c]);
            this.setState({ isPrivilegeMode: false });
            return;
        }

        // 2. Resolve matching token ability mode
        if (actionPhase === 'SelectMatchingToken') {
            const targetColor = pendingAbilityInfo?.targetColor;
            if (token !== targetColor) {
                alert(`Must select a matching ${targetColor} token!`);
                return;
            }
            mp.resolveMatchingToken([r, c]);
            return;
        }

        // 3. Normal turn board selections
        if (actionPhase !== 'Normal') return;

        if (!token) {
            // Clicking empty cell clears selections
            this.setState({ selectedCells: [], selectedGoldCoord: null });
            return;
        }

        if (token === 'gold') {
            // Select Gold for reservation
            const isSelected = this.state.selectedGoldCoord && 
                             this.state.selectedGoldCoord[0] === r && 
                             this.state.selectedGoldCoord[1] === c;
            this.setState({
                selectedGoldCoord: isSelected ? null : [r, c],
                selectedCells: [] // clear gem selections
            });
            return;
        }

        // Selected a gem/pearl
        this.setState({ selectedGoldCoord: null }); // clear gold selection

        const alreadyIndex = this.state.selectedCells.findIndex(cell => cell[0] === r && cell[1] === c);
        const newSelected = [...this.state.selectedCells];

        if (alreadyIndex !== -1) {
            newSelected.splice(alreadyIndex, 1);
        } else {
            if (newSelected.length >= 3) {
                // Max 3 tokens
                newSelected.shift();
            }
            newSelected.push([r, c]);
        }

        this.setState({ selectedCells: newSelected });
    }

    // Helper to validate selected cells geometric straight line
    private validateSelectedLine(): { valid: boolean; reason: string } {
        const coords = this.state.selectedCells;
        if (coords.length === 0) return { valid: false, reason: 'No tokens selected' };
        if (coords.length === 1) return { valid: true, reason: '' };

        const sorted = [...coords].sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]);
        const [r1, c1] = sorted[0];
        const [r2, c2] = sorted[1];
        
        const dr = r2 - r1;
        const dc = c2 - c1;

        if (Math.abs(dr) > 1 || Math.abs(dc) > 1 || (dr === 0 && dc === 0)) {
            return { valid: false, reason: 'Selected tokens must be adjacent' };
        }

        if (coords.length === 3) {
            const [r3, c3] = sorted[2];
            const dr2 = r3 - r2;
            const dc2 = c3 - c2;
            if (dr !== dr2 || dc !== dc2) {
                return { valid: false, reason: 'Selected tokens must form a continuous straight line' };
            }
        }

        return { valid: true, reason: '' };
    }

    private getPlayerHandSize(tokens: Record<TokenColor, number>): number {
        let sum = 0;
        for (const k in tokens) {
            sum += tokens[k as TokenColor] || 0;
        }
        return sum;
    }

    // Toggle discard token selection
    private handleDiscardToggle(color: TokenColor) {
        const tokens = this.props.tokens as Record<TokenColor, number>;
        const currentCountInHand = tokens[color] || 0;

        const currentSelectedCount = this.state.discardSelections.filter(c => c === color).length;
        if (currentSelectedCount >= currentCountInHand) {
            // Cannot select more than owned
            const idx = this.state.discardSelections.indexOf(color);
            if (idx !== -1) {
                const newS = [...this.state.discardSelections];
                newS.splice(idx, 1);
                this.setState({ discardSelections: newS });
            }
            return;
        }

        this.setState({ discardSelections: [...this.state.discardSelections, color] });
    }

    private handleRemoveDiscard(color: TokenColor) {
        const idx = this.state.discardSelections.indexOf(color);
        if (idx !== -1) {
            const newS = [...this.state.discardSelections];
            newS.splice(idx, 1);
            this.setState({ discardSelections: newS });
        }
    }

    public render() {
        const mp = this.props.MP;
        const {
            gameStatus, actionPhase, currentPlayerId, board, bagSize, deckSizes,
            pyramid, royalsPool, privilegesAboveBoard, winnerId, lastMove,
            pendingAbilityInfo, pendingRoyalCount,
            tokens, cards, royals, reserved, privileges, prestige, crowns, bonuses, isStuck,
            opponentId, opponentTokens, opponentCards, opponentRoyals, opponentReservedCount,
            opponentPrivileges, opponentPrestige, opponentCrowns, opponentBonuses,
            playerNames
        } = this.props;

        const isMyTurn = currentPlayerId === mp.myId;

        // 1. Game Over View
        if (gameStatus === GameStatus.GameOver) {
            const isWinner = winnerId === mp.myId;
            return (
                <div className="splendor-game-arena game-over-screen" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <h1 style={{ fontSize: '3rem', textTransform: 'uppercase' }}>
                        {isWinner ? '🏆 Victory! 🏆' : '💀 Defeat! 💀'}
                    </h1>
                    <p style={{ fontSize: '1.2rem', margin: '20px 0', fontWeight: 'bold' }}>
                        {winnerId ? `${playerNames[winnerId]} won the game!` : 'The game has ended.'}
                    </p>
                    {lastMove && <p style={{ color: '#a0a0a0', fontStyle: 'italic' }}>({lastMove.desc})</p>}

                    <div style={{ marginTop: '40px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        {this.props.isHost && (
                            <button className="brutalist-button reset-btn" onClick={() => mp.restartGame()}>
                                Play Again ⚔️
                            </button>
                        )}
                        {this.props.isHost && (
                            <button className="brutalist-button lobby-btn" onClick={() => mp.backToLobby()}>
                                Return to Lobby
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        // Active game render
        const totalTokens = this.getPlayerHandSize(tokens);
        const excessTokens = totalTokens - 10;

        // Adjacency checking for line take action
        const lineCheck = this.validateSelectedLine();

        const links = {
            'home': {
                'icon': 'gamepad',
                'label': 'Arena',
                'view': (
                    <div className="splendor-board-layout">
                        {/* Banners for special phases */}
                        {isMyTurn && actionPhase === 'SelectMatchingToken' && (
                            <div className="brutalist-banner ability-banner">
                                ⚡ ABILITY: Select a {tokenEmoji(pendingAbilityInfo?.targetColor as any)} <strong>{colorName(pendingAbilityInfo?.targetColor as any)}</strong> token from the board to take.
                            </div>
                        )}

                        {isMyTurn && actionPhase === 'StealToken' && (
                            <div className="brutalist-banner ability-banner">
                                ⚡ ABILITY: Select a token color to steal from your opponent:
                                <div className="steal-buttons-row">
                                    {['blue', 'white', 'green', 'black', 'red', 'pearl'].map(color => {
                                        const count = opponentTokens[color] || 0;
                                        if (count <= 0) return null;
                                        return (
                                            <button 
                                                key={color} 
                                                className="brutalist-button steal-btn"
                                                onClick={() => mp.resolveSteal(color)}
                                                style={{ backgroundColor: getBgColor(color as any), color: getTextColor(color as any) }}
                                            >
                                                {tokenEmoji(color as any)} Steal 1
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {isMyTurn && actionPhase === 'SelectRoyal' && (
                            <div className="brutalist-banner royal-banner">
                                👑 CROWN MILESTONE: Choose <strong>{pendingRoyalCount}</strong> Royal card(s) from the pool below the board.
                            </div>
                        )}

                        {isMyTurn && actionPhase === 'Discard' && (
                            <div className="brutalist-banner discard-banner">
                                🎒 BAG OVERFLOW: You have {totalTokens} tokens. Select exactly <strong>{excessTokens}</strong> token(s) to discard:
                                <div className="discard-selection-area">
                                    <div className="hand-selection">
                                        {Object.keys(tokens).map(cKey => {
                                            const color = cKey as TokenColor;
                                            const count = tokens[color] || 0;
                                            if (count <= 0) return null;
                                            const selectedCount = this.state.discardSelections.filter(c => c === color).length;
                                            return (
                                                <button 
                                                    key={color} 
                                                    className="brutalist-button discard-choice-btn"
                                                    onClick={() => this.handleDiscardToggle(color)}
                                                    style={{ backgroundColor: getBgColor(color), color: getTextColor(color) }}
                                                >
                                                    {tokenEmoji(color)} x{count} ({selectedCount} selected)
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="discard-summary">
                                        <strong>Selected to Discard:</strong>
                                        <div className="discard-bag-row">
                                            {this.state.discardSelections.map((color, idx) => (
                                                <span 
                                                    key={idx} 
                                                    className="discard-token-badge"
                                                    onClick={() => this.handleRemoveDiscard(color)}
                                                    style={{ backgroundColor: getBgColor(color), color: getTextColor(color) }}
                                                >
                                                    {tokenEmoji(color)}
                                                </span>
                                            ))}
                                        </div>
                                        {this.state.discardSelections.length === excessTokens && (
                                            <button 
                                                className="brutalist-button confirm-discard-btn"
                                                onClick={() => {
                                                    mp.discardTokens(this.state.discardSelections);
                                                    this.setState({ discardSelections: [] });
                                                }}
                                            >
                                                Confirm Discard
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {isMyTurn && isStuck && actionPhase === 'Normal' && (
                            <div className="brutalist-banner stuck-banner">
                                ⚠️ NO LEGAL MANDATORY ACTIONS: You must click the <strong>Replenish Board</strong> button to refill the board and pass a Privilege to your opponent before playing.
                            </div>
                        )}

                        <div className="arena-split-columns">
                            {/* Left Column: Opponent Dashboard, Main Board, My Dashboard */}
                            <div className="left-game-column">
                                {/* Opponent Panel */}
                                <div className="player-panel opponent-panel">
                                    <div className="panel-header">
                                        <span>👤 {playerNames[opponentId] || 'Opponent'}</span>
                                        <div className="panel-badges">
                                            <span className="badge prestige-badge">⭐ {opponentPrestige}</span>
                                            <span className="badge crown-badge">👑 {opponentCrowns}</span>
                                            <span className="badge privilege-badge">📜 {opponentPrivileges}</span>
                                        </div>
                                    </div>
                                    <div className="panel-tokens">
                                        {Object.keys(opponentTokens).map(cKey => {
                                            const color = cKey as TokenColor;
                                            const count = opponentTokens[color] || 0;
                                            return (
                                                <div key={color} className="token-count" style={{ borderColor: getBgColor(color) }}>
                                                    {tokenEmoji(color)} <strong>x{count}</strong>
                                                </div>
                                            );
                                        })}
                                        <div className="token-count reserved-count" style={{ borderColor: '#8a2be2' }}>
                                            🔒 Reserved: <strong>x{opponentReservedCount}</strong>
                                        </div>
                                    </div>
                                    <div className="panel-bonuses">
                                        {Object.keys(opponentBonuses).map(cKey => {
                                            const color = cKey as TokenColor;
                                            const count = opponentBonuses[color] || 0;
                                            if (count <= 0) return null;
                                            return (
                                                <span key={color} className="bonus-icon-badge" style={{ backgroundColor: getBgColor(color), color: getTextColor(color) }}>
                                                    {tokenEmoji(color)} +{count}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Shared Pool / Board Controls */}
                                <div className="board-header-controls">
                                    <div className="pool-scrolls">
                                        📜 Scrolls Above Board: <strong>{privilegesAboveBoard}</strong>
                                    </div>
                                    <div className="bag-indicator">
                                        🎒 Bag: <strong>{bagSize} tokens</strong>
                                    </div>
                                    <div className="board-actions">
                                        {isMyTurn && actionPhase === 'Normal' && (
                                            <button 
                                                className="brutalist-button use-privilege-toggle"
                                                onClick={() => this.setState({ isPrivilegeMode: !this.state.isPrivilegeMode, selectedCells: [], selectedGoldCoord: null })}
                                                style={{ backgroundColor: this.state.isPrivilegeMode ? '#f6d32d' : '', color: this.state.isPrivilegeMode ? '#000' : '' }}
                                                disabled={privileges <= 0}
                                            >
                                                {this.state.isPrivilegeMode ? 'Cancel Scroll' : 'Spend Scroll 📜'}
                                            </button>
                                        )}
                                        {isMyTurn && actionPhase === 'Normal' && (
                                            <button 
                                                className="brutalist-button replenish-board-btn"
                                                onClick={() => mp.replenishBoard(isStuck)}
                                                disabled={bagSize <= 0}
                                            >
                                                Replenish Board 🔄
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* 5x5 Central Board */}
                                <div className="board-container">
                                    {this.state.isPrivilegeMode && (
                                        <div className="action-helper-text">
                                            📜 Spend Scroll: Click any non-Gold token to take it immediately!
                                        </div>
                                    )}
                                    {actionPhase === 'SelectMatchingToken' && isMyTurn && (
                                        <div className="action-helper-text">
                                            ⚡ Ability: Click a {tokenEmoji(pendingAbilityInfo?.targetColor as any)} token to take it!
                                        </div>
                                    )}
                                    <div className="grid-5x5">
                                        {board.map((row: any[], r: number) => 
                                            row.map((token: TokenColor | null, c: number) => {
                                                const isSelected = this.state.selectedCells.some(cell => cell[0] === r && cell[1] === c);
                                                const isGoldSelected = this.state.selectedGoldCoord && 
                                                                     this.state.selectedGoldCoord[0] === r && 
                                                                     this.state.selectedGoldCoord[1] === c;
                                                const isMatchingHighlight = actionPhase === 'SelectMatchingToken' && 
                                                                           token === pendingAbilityInfo?.targetColor;

                                                return (
                                                    <div 
                                                        key={`${r}-${c}`} 
                                                        className={`board-cell ${isSelected ? 'cell-selected' : ''} ${isGoldSelected ? 'gold-selected' : ''} ${isMatchingHighlight ? 'matching-highlight' : ''}`}
                                                        onClick={() => this.handleCellClick(r, c, token)}
                                                    >
                                                        {token && (
                                                            <div 
                                                                className="board-gem-token"
                                                                style={{ background: getBgColor(token) }}
                                                            >
                                                                <span className="gem-emoji">{tokenEmoji(token)}</span>
                                                            </div>
                                                        )}
                                                        <span className="coords-debug">{r},{c}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    {/* Action execution box for board tokens */}
                                    {isMyTurn && actionPhase === 'Normal' && (
                                        <div className="board-selection-execution">
                                            {this.state.selectedCells.length > 0 && (
                                                <div className="execution-panel">
                                                    {lineCheck.valid ? (
                                                        <button 
                                                            className="brutalist-button execute-take-btn"
                                                            onClick={() => {
                                                                mp.takeTokens(this.state.selectedCells);
                                                                this.setState({ selectedCells: [] });
                                                            }}
                                                        >
                                                            Take {this.state.selectedCells.length} Selected Tokens
                                                        </button>
                                                    ) : (
                                                        <span className="invalid-warning">⚠️ {lineCheck.reason}</span>
                                                    )}
                                                </div>
                                            )}
                                            {this.state.selectedGoldCoord && (
                                                <div className="execution-panel">
                                                     <span className="gold-tip">🪙 Gold token selected! Select a card from the pyramid (or click &quot;Reserve Blind&quot; on a deck level) to reserve it + claim the Gold.</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Active Player Panel */}
                                <div className="player-panel my-panel active-player-panel">
                                    <div className="panel-header">
                                        <span>👤 {playerNames[mp.myId]} (You)</span>
                                        {isMyTurn && <span className="turn-indicator">Your Turn ⚔️</span>}
                                        <div className="panel-badges">
                                            <span className="badge prestige-badge">⭐ {prestige}</span>
                                            <span className="badge crown-badge">👑 {crowns}</span>
                                            <span className="badge privilege-badge">📜 {privileges}</span>
                                        </div>
                                    </div>
                                    <div className="panel-tokens">
                                        {Object.keys(tokens).map(cKey => {
                                            const color = cKey as TokenColor;
                                            const count = tokens[color] || 0;
                                            return (
                                                <div key={color} className="token-count" style={{ borderColor: getBgColor(color) }}>
                                                    {tokenEmoji(color)} <strong>x{count}</strong>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="panel-bonuses">
                                        {Object.keys(bonuses).map(cKey => {
                                            const color = cKey as TokenColor;
                                            const count = bonuses[color] || 0;
                                            if (count <= 0) return null;
                                            return (
                                                <span key={color} className="bonus-icon-badge" style={{ backgroundColor: getBgColor(color), color: getTextColor(color) }}>
                                                    {tokenEmoji(color)} +{count}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Card Pyramid, Royals, Reserved, Owned Cards */}
                            <div className="right-game-column">
                                {/* Jewel Cards Pyramid */}
                                <div className="pyramid-container">
                                    <h3 style={{ borderBottom: '3px solid #000', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Jewel Cards Pyramid</h3>
                                    
                                    {[3, 2, 1].map(level => {
                                        const row = pyramid[level as 1 | 2 | 3] || [];
                                        const deckSize = deckSizes[level as 1 | 2 | 3] || 0;
                                        return (
                                            <div key={level} className={`pyramid-row level-${level}`}>
                                                {/* Blind Deck Slot */}
                                                <div className="deck-card-slot">
                                                    <div className="deck-card-back">
                                                        <span className="level-dots">
                                                            {Array(level).fill('●').join('')}
                                                        </span>
                                                        <span className="deck-count">x{deckSize}</span>
                                                        {isMyTurn && actionPhase === 'Normal' && this.state.selectedGoldCoord && deckSize > 0 && (
                                                            <button 
                                                                className="brutalist-button reserve-blind-btn"
                                                                onClick={() => {
                                                                    mp.reserveCard(null, level, this.state.selectedGoldCoord);
                                                                    this.setState({ selectedGoldCoord: null });
                                                                }}
                                                            >
                                                                Reserve Blind
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Face Up Cards */}
                                                <div className="pyramid-cards-row">
                                                    {row.map((card: Card | null, idx: number) => {
                                                        if (!card) return <div key={idx} className="card-empty-slot" />;
                                                        return this.renderCardComponent(card, true, isMyTurn && actionPhase === 'Normal');
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Royals Pool */}
                                <div className="royals-pool-container">
                                    <h3 style={{ borderBottom: '3px solid #000', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Royal Cards Pool</h3>
                                    <div className="royals-row">
                                        {royalsPool.length === 0 ? (
                                            <p style={{ fontStyle: 'italic', color: '#a0a0a0' }}>Royal cards pool is empty</p>
                                        ) : (
                                            royalsPool.map((royal: RoyalCard) => {
                                                const canClaim = isMyTurn && actionPhase === 'SelectRoyal';
                                                return (
                                                    <div 
                                                        key={royal.id} 
                                                        className={`royal-pool-card ${canClaim ? 'clickable-royal' : ''}`}
                                                        onClick={() => canClaim && mp.selectRoyal(royal.id)}
                                                    >
                                                        <span className="royal-points">⭐ {royal.points}</span>
                                                        {royal.ability && <span className="royal-ability">⚡ {royal.ability}</span>}
                                                        <span className="royal-label">ROYAL</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Reserved Cards (Secret Info) */}
                                <div className="reserved-cards-container">
                                    <h3 style={{ borderBottom: '3px solid #000', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>My Reserved Cards ({reserved.length}/3)</h3>
                                    <div className="reserved-row">
                                        {reserved.length === 0 ? (
                                            <p style={{ fontStyle: 'italic', color: '#a0a0a0' }}>No reserved cards</p>
                                        ) : (
                                            reserved.map((card: Card) => this.renderCardComponent(card, false, isMyTurn && actionPhase === 'Normal'))
                                        )}
                                    </div>
                                </div>

                                {/* Joker Assigning Modal/Overlay */}
                                {this.state.selectedJokerCardId && (
                                    <div className="brutalist-overlay">
                                        <div className="brutalist-modal">
                                            <h3>Assign Joker Color 🌈</h3>
                                            <p>Select which of your owned bonus colors this joker will copy:</p>
                                            <div className="joker-color-choices">
                                                {['blue', 'white', 'green', 'black', 'red'].map(col => {
                                                    const count = bonuses[col as TokenColor] || 0;
                                                    if (count <= 0) return null; // must own a bonus of that color
                                                    return (
                                                        <button 
                                                            key={col} 
                                                            className="brutalist-button color-choice-btn"
                                                            onClick={() => {
                                                                mp.purchaseCard(this.state.selectedJokerCardId, col);
                                                                this.setState({ selectedJokerCardId: null });
                                                            }}
                                                            style={{ backgroundColor: getBgColor(col as any), color: getTextColor(col as any) }}
                                                        >
                                                            {tokenEmoji(col as any)} {colorName(col as any)} (+{count} owned)
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <button 
                                                className="brutalist-button cancel-btn"
                                                onClick={() => this.setState({ selectedJokerCardId: null })}
                                                style={{ marginTop: '20px' }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <SplendorDuelRulesView />
            },
            'history': {
                'icon': 'history',
                'label': 'Log',
                'view': (
                    <div className="splendor-rules-panel" style={{ padding: '20px' }}>
                        <h3>Game Activity Log 📜</h3>
                        {lastMove ? (
                            <div className="brutalist-log-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '65vh', overflowY: 'auto' }}>
                                <div style={{
                                    backgroundColor: '#f2f2f2',
                                    border: '2px solid #000',
                                    padding: '10px',
                                    fontWeight: 'bold'
                                }}>
                                    Latest Action: {playerNames[lastMove.playerId]} {lastMove.desc}
                                </div>
                                <p style={{ fontStyle: 'italic', color: '#888', fontSize: '0.9em', marginTop: '15px' }}>
                                    Note: Live game actions are broadcasted via notifications as they happen.
                                </p>
                            </div>
                        ) : (
                            <p style={{ fontStyle: 'italic', color: '#a0a0a0' }}>No moves logged yet.</p>
                        )}
                    </div>
                )
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Admin',
                'view': (
                    <div className="splendor-rules-panel" style={{ padding: '20px', textAlign: 'center' }}>
                        <h3>Game Settings ⚙️</h3>
                        <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                            <button className="brutalist-button reset-btn" onClick={() => mp.restartGame()}>Restart Game 🔄</button>
                            <button className="brutalist-button lobby-btn" onClick={() => mp.backToLobby()}>Back to Lobby</button>
                        </div>
                    </div>
                )
            };
        }

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': links,
                'gameName': 'Splendor Duel',
                'topBarContent': isMyTurn ? `Your Turn ⚔️` : `Waiting for opponent...`
            }
        );
    }

    // Custom renderer for Jewel Cards (Premium Neo-Brutalist Styling)
    private renderCardComponent(card: Card, isFromPyramid: boolean, canInteract: boolean) {
        const mp = this.props.MP;
        const bonuses = this.props.bonuses || {};
        const playerGold = this.props.tokens?.gold || 0;
        const playerTokens = this.props.tokens || {};

        // Calculate if player can afford it
        let goldNeeded = 0;
        let canAfford = true;
        for (const cKey in card.cost) {
            const color = cKey as TokenColor;
            const cardCost = card.cost[color] || 0;
            const discount = color === 'pearl' ? 0 : (bonuses[color] || 0);
            const effectiveCost = Math.max(0, cardCost - discount);
            const owned = playerTokens[color] || 0;
            if (owned < effectiveCost) {
                goldNeeded += (effectiveCost - owned);
            }
        }
        if (goldNeeded > playerGold) {
            canAfford = false;
        }

        // If card is wild/joker, they must also own at least one bonus color to buy it
        const hasAnyBonus = Object.values(bonuses).some((count: number) => count > 0);
        const jokerPreconditionMet = card.color !== 'wild' || hasAnyBonus;

        const buyEnabled = canInteract && canAfford && jokerPreconditionMet;
        const reserveEnabled = canInteract && isFromPyramid && this.state.selectedGoldCoord && this.props.reserved.length < 3;

        return (
            <div 
                key={card.id} 
                className={`jewel-card level-${card.level} color-${card.color || 'gray'}`}
                style={{
                    border: '3px solid #000',
                    boxShadow: '4px 4px 0px #000',
                    background: card.color === 'wild' ? getBgColor('wild') : '#ffffff'
                }}
            >
                {/* Top Section */}
                <div className="card-top-row">
                    <span className="card-prestige" style={{ color: card.color === 'wild' ? '#ffffff' : '#000000' }}>
                        {card.points > 0 ? `⭐ ${card.points}` : ''}
                    </span>
                    <span className="card-crowns">
                        {card.crowns > 0 ? Array(card.crowns).fill('👑').join('') : ''}
                    </span>
                    <span className="card-bonus">
                        {card.bonus_color && (
                            <span 
                                className="bonus-pill"
                                style={{
                                    backgroundColor: getBgColor(card.bonus_color),
                                    color: getTextColor(card.bonus_color),
                                    border: '2px solid #000'
                                }}
                            >
                                {tokenEmoji(card.bonus_color)}
                                {card.bonus_count > 1 ? ` x${card.bonus_count}` : ''}
                            </span>
                        )}
                    </span>
                </div>

                {/* Middle Ability badge */}
                {card.ability && (
                    <div className="card-ability-badge">
                        ⚡ {card.ability.toUpperCase().replace('_', ' ')}
                    </div>
                )}

                {/* Bottom Cost and Actions */}
                <div className="card-bottom-area">
                    <div className="cost-row">
                        {Object.keys(card.cost).map(cKey => {
                            const color = cKey as TokenColor;
                            const amt = card.cost[color] || 0;
                            const discount = color === 'pearl' ? 0 : (bonuses[color] || 0);
                            const effectiveCost = Math.max(0, amt - discount);

                            return (
                                <div 
                                    key={color} 
                                    className={`cost-bubble ${effectiveCost === 0 ? 'cost-discounted' : ''}`}
                                    style={{
                                        backgroundColor: getBgColor(color),
                                        color: getTextColor(color),
                                        border: '2px solid #000'
                                    }}
                                >
                                    {tokenEmoji(color)} {amt}
                                </div>
                            );
                        })}
                    </div>

                    {/* Action buttons overlay */}
                    {canInteract && (
                        <div className="card-action-overlay">
                            {buyEnabled && (
                                <button 
                                    className="brutalist-button card-buy-btn"
                                    onClick={() => {
                                        if (card.color === 'wild') {
                                            // Open assigning joker popup
                                            this.setState({ selectedJokerCardId: card.id });
                                        } else {
                                            mp.purchaseCard(card.id);
                                        }
                                    }}
                                >
                                    Buy 💰
                                </button>
                            )}
                            {reserveEnabled && (
                                <button 
                                    className="brutalist-button card-reserve-btn"
                                    onClick={() => {
                                        mp.reserveCard(card.id, null, this.state.selectedGoldCoord);
                                        this.setState({ selectedGoldCoord: null });
                                    }}
                                >
                                    Reserve
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className="card-level-indicator">
                    {Array(card.level).fill('●').join('')}
                </div>
            </div>
        );
    }
}
