/**
 * SplendorDuelViews.tsx - React components for Splendor Duel
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { GameStatus, Card, RoyalCard, TokenColor, ActionPhase } from '../SplendorDuelGameState';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import {
    SPLENDOR_DUEL_ICONS,
    getSplendorDuelCardDefinition,
    getDeckBackDefinition,
    getRoyalCardDefinition,
    getSplendorDuelPalette
} from '../SplendorDuelAssets';

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
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                            {playerCount !== 2 && (
                                <p style={{ color: '#e01b24', fontWeight: 'bold', fontSize: '0.9em', textAlign: 'center' }}>
                                    ⚠️ Splendor Duel is strictly a 2-player game. Currently {playerCount} player(s) in lobby.
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
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div style={{
                            backgroundColor: '#fbeec2',
                            color: '#7a5a00',
                            padding: '15px',
                            border: 'none',
                            borderRadius: '12px',
                            boxShadow: 'none',
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
    // Render one of the game's actual vector card glyphs (not an emoji) for the legend.
    private glyph(iconId: string, size: string = '1.7em', color: TokenColor | 'wild' | null = null, colorOverride?: string) {
        const icon = SPLENDOR_DUEL_ICONS[iconId];
        if (!icon) return null;
        return (
            <span style={{ display: 'inline-flex', width: size, height: size, flex: '0 0 auto', alignItems: 'center', justifyContent: 'center' }}>
                <ExpressiveIcon icon={icon} palette={getSplendorDuelPalette(color)} colorOverride={colorOverride} />
            </span>
        );
    }

    public render() {
        // A representative jewel card used to illustrate the anatomy legend.
        const anatomyCard: Card = {
            id: 'anatomy-sample',
            level: 3,
            color: 'red',
            points: 3,
            crowns: 2,
            bonus_color: 'red',
            bonus_count: 1,
            ability: null,
            cost: { blue: 5, green: 3, black: 3 }
        };

        return (
            <div className="splendor-rules-panel" style={{ padding: '20px', overflowY: 'auto', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="rules-section" style={{ backgroundColor: '#fff', border: '1px solid #e3ddee', boxShadow: 'none', padding: '15px', borderRadius: '12px' }}>
                    <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Three Ways to Win</h3>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.6', margin: 0 }}>
                        <li><strong>Condition 1:</strong> Acquire <strong>20+ total Prestige points</strong>.</li>
                        <li><strong>Condition 2:</strong> Collect <strong>10+ Crowns</strong> (crowns are printed on some Jewel cards).</li>
                        <li><strong>Condition 3:</strong> Accumulate <strong>10+ Prestige points</strong> on cards of a <strong>single color</strong> (wild/jokers count as their assigned color; gray cards without bonuses do not count).</li>
                    </ul>
                </div>

                <div className="rules-section" style={{ backgroundColor: '#fff', border: '1px solid #e3ddee', boxShadow: 'none', padding: '15px', borderRadius: '12px' }}>
                    <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>On Your Turn</h3>
                    <p style={{ margin: '0 0 10px 0' }}>Optionally perform actions 1 & 2 (in order), then perform exactly ONE mandatory action:</p>
                    <ol style={{ paddingLeft: '20px', lineHeight: '1.6', margin: 0 }}>
                        <li><strong>[Optional] Use Privilege:</strong> Spend a scroll to take 1 non-gold token from the board.</li>
                        <li><strong>[Optional] Replenish Board:</strong> Refill empty board spaces from the bag (opponent gets 1 Privilege).</li>
                        <li><strong>[Mandatory A] Take Tokens:</strong> Take up to 3 adjacent Gem/Pearl tokens forming an uninterrupted straight line (no gold, no empty spaces between them). Taking 3 same-colored or 2 pearls gives your opponent 1 Privilege.</li>
                        <li><strong>[Mandatory B] Reserve + Gold:</strong> Take 1 Gold token from the board and reserve 1 card (pyramid or blind draw). Max 3 reserved cards.</li>
                        <li><strong>[Mandatory C] Purchase Card:</strong> Pay the token cost (reduced by bonuses of matching colors). Gold acts as a wild color.</li>
                    </ol>
                </div>

                <div className="rules-section" style={{ backgroundColor: '#fff', border: '1px solid #e3ddee', boxShadow: 'none', padding: '15px', borderRadius: '12px' }}>
                    <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tokens & The Bag</h3>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.6', margin: 0 }}>
                        <li><strong>The Bag:</strong> Spent tokens (paid for card purchases) and discarded tokens return to the shared bag. Replenishing the board draws tokens randomly from this bag.</li>
                        <li><strong>10-Token Limit:</strong> You may hold a maximum of <strong>10 tokens</strong> (gems, pearls, and gold combined) in your hand at any time.</li>
                        <li><strong>Exceeding the Limit:</strong> If your turn ends and you have more than 10 tokens, you must immediately choose and discard the excess tokens back into the bag until your hand size is exactly 10.</li>
                    </ul>
                </div>

                <div className="rules-section" style={{ backgroundColor: '#fff', border: '1px solid #e3ddee', boxShadow: 'none', padding: '15px', borderRadius: '12px' }}>
                    <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Card Anatomy</h3>
                    <p style={{ margin: '0 0 14px 0' }}>Every Jewel Card packs its information into a few fixed spots. Here is a real card and what each part means:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
                        <div className="jewel-card level-3 color-red" style={{ width: '150px', height: '210px', flex: '0 0 auto' }}>
                            <PlayingCard
                                card={getSplendorDuelCardDefinition(anatomyCard, {})}
                                width="150px"
                                customIcons={SPLENDOR_DUEL_ICONS}
                            />
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px', flex: '1 1 240px', minWidth: '220px', lineHeight: '1.4' }}>
                            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                {this.glyph('star')}
                                <span><strong>Prestige points</strong> (top-left) &mdash; the large number. First player to <strong>20</strong> total points wins.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                {this.glyph('crown', '1.9em', null, '#12181f')}
                                <span><strong>Crowns</strong> (just under the points) &mdash; one glyph per crown. Collect <strong>10</strong> to win; your 3rd &amp; 6th crown each let you claim a Royal.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                {this.glyph('gem_red_bonus', '1.8em', 'red')}
                                <span><strong>Colour bonus</strong> (top-right) &mdash; a permanent gem. It discounts every future purchase of that colour and counts toward the single-colour win.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span style={{ display: 'inline-flex', gap: '3px', flex: '0 0 auto' }}>
                                    {this.glyph('gem_blue_coin', '1.5em')}
                                    {this.glyph('gem_green_coin', '1.5em')}
                                </span>
                                <span><strong>Cost</strong> (left column) &mdash; the tokens you pay to buy it. Matching colour bonuses reduce it; Gold pays for any colour.</span>
                            </li>
                        </ul>
                    </div>
                    <p style={{ margin: '14px 0 0 0', fontStyle: 'italic', color: '#5f5e6a' }}>
                        Some cards also carry an immediate <strong>ability</strong>, shown as a label across the bottom &mdash; see the Abilities table below.
                    </p>
                </div>

                <div className="rules-section" style={{ backgroundColor: '#fff', border: '1px solid #e3ddee', boxShadow: 'none', padding: '15px', borderRadius: '12px' }}>
                    <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Royal Cards & Milestones</h3>
                    <p style={{ margin: '0 0 10px 0' }}>Royal cards are special rewards set aside from the main pyramid:</p>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.6', margin: 0 }}>
                        <li><strong>How to claim:</strong> As soon as you acquire your <strong>3rd Crown</strong> and your <strong>6th Crown</strong> across your purchased cards, you immediately trigger a milestone. On the same turn, you must choose 1 Royal card from the pool to add to your area.</li>
                        <li><strong>Benefits:</strong> Royal cards do not have a cost. They grant <strong>2 or 3 Prestige points</strong> and often feature immediate abilities like Steal, Privilege, or Extra Turn.</li>
                    </ul>
                </div>

                <div className="rules-section" style={{ backgroundColor: '#fff', border: '1px solid #e3ddee', boxShadow: 'none', padding: '15px', borderRadius: '12px' }}>
                    <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Card Abilities (Immediate)</h3>
                    <p style={{ margin: '0 0 10px 0' }}>Triggered immediately when purchasing a card (Jewel or Royal):</p>
                    <table className="brutalist-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e3ddee', borderRadius: '10px', overflow: 'hidden' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#fbeec2', borderBottom: '1px solid #ece8f2', color: '#7a5a00' }}>
                                <th style={{ borderRight: '1px solid #ece8f2', padding: '8px', textAlign: 'left' }}>Ability</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Effect</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid #ece8f2' }}>
                                <td style={{ borderRight: '1px solid #ece8f2', padding: '8px', fontWeight: 'bold' }}>Extra Turn</td>
                                <td style={{ padding: '8px' }}>Take another full turn immediately after this turn ends.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #ece8f2' }}>
                                <td style={{ borderRight: '1px solid #ece8f2', padding: '8px', fontWeight: 'bold' }}>Take Matching</td>
                                <td style={{ padding: '8px' }}>Take 1 token from the board matching this card&apos;s bonus color.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #ece8f2' }}>
                                <td style={{ borderRight: '1px solid #ece8f2', padding: '8px', fontWeight: 'bold' }}>Steal</td>
                                <td style={{ padding: '8px' }}>Take 1 gem or pearl token from your opponent (cannot steal gold).</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #ece8f2' }}>
                                <td style={{ borderRight: '1px solid #ece8f2', padding: '8px', fontWeight: 'bold' }}>Privilege</td>
                                <td style={{ padding: '8px' }}>Gain 1 Privilege scroll (steal one from opponent if pool is empty).</td>
                            </tr>
                            <tr>
                                <td style={{ borderRight: '1px solid #ece8f2', padding: '8px', fontWeight: 'bold' }}>Joker / Wild</td>
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

        if (currentPlayerId !== mp.clientId) return;

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

    // Flat vector icon (gem coin, star, crown, scroll, lock) for panel elements.
    // Sizing is controlled per-context via the `.mp-icon` rules in the stylesheet.
    // `color` selects the palette (so palette-keyed fills like 'primary' resolve to that gem);
    // `colorOverride` forces every layer to one colour (for solid legend/badge glyphs).
    private mpIcon(iconId: string, color: TokenColor | 'wild' | null = null, colorOverride?: string) {
        const icon = SPLENDOR_DUEL_ICONS[iconId];
        if (!icon) return null;
        return (
            <span className="mp-icon">
                <ExpressiveIcon icon={icon} palette={getSplendorDuelPalette(color)} colorOverride={colorOverride} />
            </span>
        );
    }

    public render() {
        const mp = this.props.MP;
        const myId = mp.clientId;
        const {
            gameStatus, actionPhase, currentPlayerId, board, bagSize, deckSizes,
            pyramid, royalsPool, privilegesAboveBoard, winnerId, lastMove,
            pendingAbilityInfo, pendingRoyalCount,
            tokens, cards, royals, reserved, privileges, prestige, crowns, bonuses, isStuck,
            opponentId, opponentTokens, opponentCards, opponentRoyals, opponentReservedCount,
            opponentPrivileges, opponentPrestige, opponentCrowns, opponentBonuses,
            playerNames
        } = this.props;

        const isMyTurn = currentPlayerId === myId;

        // 1. Game Over View
        if (gameStatus === GameStatus.GameOver) {
            const isWinner = winnerId === myId;
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
                                Play Again
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
                                CROWN MILESTONE: Choose <strong>{pendingRoyalCount}</strong> Royal card(s) from the pool below the board.
                            </div>
                        )}

                        {isMyTurn && actionPhase === 'Discard' && (
                            <div className="brutalist-banner discard-banner">
                                TOKENS OVERFLOW: You have {totalTokens} tokens. Select exactly {excessTokens} token{excessTokens > 1 && 's'} to discard:
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
                                                    className={`brutalist-button discard-choice-btn ${selectedCount > 0 ? 'is-selected' : ''}`}
                                                    onClick={() => this.handleDiscardToggle(color)}
                                                >
                                                    {this.mpIcon(`gem_${color}_coin`)}x{count}
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
                                                    title="Click to remove"
                                                >
                                                    {this.mpIcon(`gem_${color}_coin`)}
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
                                                            <div className="board-gem-token">
                                                                <ExpressiveIcon
                                                                    icon={SPLENDOR_DUEL_ICONS[`gem_${token}_coin`]}
                                                                    palette={getSplendorDuelPalette(token as any)}
                                                                />
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
                                                        <span className="invalid-warning">{lineCheck.reason}</span>
                                                    )}
                                                </div>
                                            )}
                                            {this.state.selectedGoldCoord && (
                                                <div className="execution-panel">
                                                    <span className="gold-tip">Gold token selected! Select a card from the pyramid (or click &quot;Reserve Blind&quot; on a deck level) to reserve it + claim the Gold.</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Active Player Panel */}
                                <div className="player-panel my-panel active-player-panel">
                                    <div className="panel-header">
                                        <span className="panel-name">{playerNames[myId]} (You)</span>
                                        {isMyTurn && <span className="turn-indicator">Your Turn</span>}
                                        <div className="panel-badges">
                                            <span className="badge prestige-badge">{this.mpIcon('star', null, '#7a5a00')} {prestige}</span>
                                            <span className="badge crown-badge">{this.mpIcon('crown', null, '#8a4712')} {crowns}</span>
                                            <span className="badge privilege-badge">{this.mpIcon('scroll', null, '#303f78')} {privileges}</span>
                                        </div>
                                    </div>
                                    <div className="panel-tokens">
                                        <span className="panel-group-label">Spendable tokens</span>
                                        {Object.keys(tokens).map(cKey => {
                                            const color = cKey as TokenColor;
                                            const count = tokens[color] || 0;
                                            return (
                                                <div key={color} className="token-count">
                                                    {this.mpIcon(`gem_${color}_coin`)} <strong>x{count}</strong>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="panel-bonuses">
                                        {Object.values(bonuses).some((c: number) => c > 0) && (
                                            <span className="panel-group-label">Permanent bonuses <em>(from cards)</em></span>
                                        )}
                                        {Object.keys(bonuses).map(cKey => {
                                            const color = cKey as TokenColor;
                                            const count = bonuses[color] || 0;
                                            if (count <= 0) return null;
                                            return (
                                                <span key={color} className="bonus-icon-badge">
                                                    {this.mpIcon(`gem_${color}_coin`)} +{count}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Opponent Panel — kept last so it sits at the bottom of the mobile stack */}
                                <div className="player-panel opponent-panel">
                                    <div className="panel-header">
                                        <span className="panel-name">{playerNames[opponentId] || 'Opponent'}</span>
                                        <div className="panel-badges">
                                            <span className="badge prestige-badge">{this.mpIcon('star', null, '#7a5a00')} {opponentPrestige}</span>
                                            <span className="badge crown-badge">{this.mpIcon('crown', null, '#8a4712')} {opponentCrowns}</span>
                                            <span className="badge privilege-badge">{this.mpIcon('scroll', null, '#303f78')} {opponentPrivileges}</span>
                                        </div>
                                    </div>
                                    <div className="panel-tokens">
                                        <span className="panel-group-label">Spendable tokens</span>
                                        {Object.keys(opponentTokens).map(cKey => {
                                            const color = cKey as TokenColor;
                                            const count = opponentTokens[color] || 0;
                                            return (
                                                <div key={color} className="token-count">
                                                    {this.mpIcon(`gem_${color}_coin`)} <strong>x{count}</strong>
                                                </div>
                                            );
                                        })}
                                        <div className="token-count reserved-count">
                                            {this.mpIcon('lock')} Reserved <strong>x{opponentReservedCount}</strong>
                                        </div>
                                    </div>
                                    <div className="panel-bonuses">
                                        {Object.values(opponentBonuses).some((c: number) => c > 0) && (
                                            <span className="panel-group-label">Permanent bonuses <em>(from cards)</em></span>
                                        )}
                                        {Object.keys(opponentBonuses).map(cKey => {
                                            const color = cKey as TokenColor;
                                            const count = opponentBonuses[color] || 0;
                                            if (count <= 0) return null;
                                            return (
                                                <span key={color} className="bonus-icon-badge">
                                                    {this.mpIcon(`gem_${color}_coin`)} +{count}
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
                                    <h3 style={{ paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#2b2440' }}>Jewel Cards Pyramid</h3>

                                    {[3, 2, 1].map(level => {
                                        const row = pyramid[level as 1 | 2 | 3] || [];
                                        const deckSize = deckSizes[level as 1 | 2 | 3] || 0;
                                        return (
                                            <div key={level} className={`pyramid-row level-${level}`}>
                                                {/* Face Up Cards */}
                                                <div className="pyramid-cards-row">
                                                    {row.map((card: Card | null, idx: number) => {
                                                        if (!card) return <div key={idx} className="card-empty-slot" />;
                                                        return this.renderCardComponent(card, true, isMyTurn && actionPhase === 'Normal');
                                                    })}
                                                </div>

                                                {/* Blind Deck Slot (right of the face-up cards) */}
                                                <div className="deck-card-slot" style={{ position: 'relative', width: '100px', height: '140px' }}>
                                                    <PlayingCard
                                                        card={getDeckBackDefinition(level)}
                                                        width="100px"
                                                        height="140px"
                                                        customIcons={SPLENDOR_DUEL_ICONS}
                                                        isFlipped={true}
                                                    />
                                                    <div className="deck-back-overlay" style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        height: '100%',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'flex-end',
                                                        alignItems: 'center',
                                                        padding: '8px',
                                                        boxSizing: 'border-box',
                                                        color: '#ffffff',
                                                        zIndex: 3,
                                                        pointerEvents: 'none'
                                                    }}>
                                                        <span className="deck-count" style={{
                                                            fontSize: '0.95em',
                                                            fontWeight: 800,
                                                            letterSpacing: '0.03em',
                                                            backgroundColor: 'rgba(20, 16, 32, 0.55)',
                                                            borderRadius: '6px',
                                                            padding: '2px 9px'
                                                        }}>×{deckSize}</span>
                                                        {isMyTurn && actionPhase === 'Normal' && this.state.selectedGoldCoord && deckSize > 0 && (
                                                            <button
                                                                className="brutalist-button reserve-blind-btn"
                                                                style={{ pointerEvents: 'auto', position: 'absolute', top: '50%', transform: 'translateY(-50%)' }}
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
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Royals Pool */}
                                <div className="royals-pool-container">
                                    <h3 style={{ paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#2b2440' }}>Royal Cards Pool</h3>
                                    <div className="royals-row">
                                        {royalsPool.length === 0 ? (
                                            <p style={{ fontStyle: 'italic', color: '#a0a0a0' }}>Royal cards pool is empty</p>
                                        ) : (
                                            royalsPool.map((royal: RoyalCard) => {
                                                const canClaim = isMyTurn && actionPhase === 'SelectRoyal';
                                                return (
                                                    <div
                                                        key={royal.id}
                                                        className={`royal-pool-card royal-card ${canClaim ? 'clickable-royal' : ''}`}
                                                        onClick={() => canClaim && mp.selectRoyal(royal.id)}
                                                        style={{ position: 'relative', width: '88px', height: '121px' }}
                                                    >
                                                        <PlayingCard
                                                            card={getRoyalCardDefinition(royal)}
                                                            width="88px"
                                                            customIcons={SPLENDOR_DUEL_ICONS}
                                                            hoverable={canClaim}
                                                        />
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Reserved Cards (Secret Info) */}
                                <div className="reserved-cards-container">
                                    <h3 style={{ paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#2b2440' }}>My Reserved Cards ({reserved.length}/3)</h3>
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
                                            <h3>Assign Joker Color</h3>
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
                                    backgroundColor: '#f7f6fb',
                                    border: '1px solid #e3ddee',
                                    borderRadius: '10px',
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
                'topBarContent': isMyTurn ? `Your Turn` : `Waiting`,
                'roomClassName': isMyTurn ? 'attention-bg' : ''
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
                className={`jewel-card level-${card.level} color-${card.color || 'gray'} ${buyEnabled ? 'is-buyable' : ''}`}
                style={{
                    position: 'relative'
                }}
            >
                <PlayingCard
                    card={getSplendorDuelCardDefinition(card, bonuses)}
                    width="115px"
                    height="155px"
                    customIcons={SPLENDOR_DUEL_ICONS}
                    hoverable={canInteract}
                />

                {/* Persistent, tap-friendly action buttons (always visible when actionable) */}
                {canInteract && (buyEnabled || reserveEnabled) && (
                    <div className="card-actions">
                        {reserveEnabled && (
                            <button
                                className="card-action-btn reserve"
                                title="Reserve card"
                                aria-label="Reserve card"
                                onClick={() => {
                                    mp.reserveCard(card.id, null, this.state.selectedGoldCoord);
                                    this.setState({ selectedGoldCoord: null });
                                }}
                            />
                        )}
                        {buyEnabled && (
                            <button
                                className="card-action-btn buy"
                                title="Buy card"
                                aria-label="Buy card"
                                onClick={() => {
                                    if (card.color === 'wild') {
                                        // Open assigning joker popup
                                        this.setState({ selectedJokerCardId: card.id });
                                    } else {
                                        mp.purchaseCard(card.id);
                                    }
                                }}
                            />
                        )}
                    </div>
                )}
            </div>
        );
    }
}
