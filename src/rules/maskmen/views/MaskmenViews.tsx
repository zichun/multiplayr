/**
 * MaskmenViews.tsx - React components for Maskmen game
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { GameStatus, WrestlerColor, PlayRecord } from '../MaskmenGameState';
import PassSound from '../../ito/sounds/pass.mp3';
import CardSound from '../../coup/sounds/card.mp3';
import SuccessSound from '../../coup/sounds/coin2.mp3';

// Lobby Views
export class MaskmenHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'gameName': 'Maskmen',
                'links': {
                    'home': {
                        'icon': 'home',
                        'label': 'Lobby',
                        'view': (
                            <div className="maskmen-lobby">
                                {mp.getPluginView('lobby', 'SetNameWithLobby')}
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
                        'view': <MaskmenRulesView />
                    }
                }
            }
        );
    }
}

export class MaskmenClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'gameName': 'Maskmen',
                'links': {
                    'home': {
                        'icon': 'id-card',
                        'label': 'Lobby',
                        'view': (
                            <div className="maskmen-lobby">
                                {mp.getPluginView('lobby', 'SetNameWithLobby')}
                                <div className="lobby-status">
                                    Waiting for Host to start...
                                </div>
                            </div>
                        )
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': <MaskmenRulesView />
                    }
                }
            });
    }
}

// Rules View
export class MaskmenRulesView extends React.Component<{}, {}> {
    public render() {
        return (
            <div style={{ padding: '15px', maxHeight: '100%', overflowY: 'auto' }}>
                <h2 style={{ borderBottom: '4px solid #000', paddingBottom: '8px' }}>Maskmen Rules</h2>
                <div style={{ fontSize: '0.95em', lineHeight: '1.5' }}>
                    <p><strong>Goal:</strong> Empty your hand of cards as quickly as possible over 4 seasons (rounds).</p>

                    <h3 style={{ marginTop: '15px', borderBottom: '2px solid #000' }}>Wrestler Strengths</h3>
                    <p>There are 6 wrestler colors. At the start of each season, wrestlers have no relative strength. Strength is established during play:</p>
                    <ul>
                        <li><strong>Option A (Introduce):</strong> Play <strong>X + 1</strong> cards of a wrestler who is unranked or equal/unknown strength compared to the current wrestler (where X is the card count of the previous play). This establishes the new wrestler as stronger.</li>
                        <li><strong>Option B (Play Known-Stronger):</strong> Play <strong>at least X</strong> cards of a wrestler who is already established as stronger than the current wrestler.</li>
                    </ul>

                    <h3 style={{ marginTop: '15px', borderBottom: '2px solid #000' }}>Rules of Play</h3>
                    <ul>
                        <li><strong>3-Card Maximum:</strong> You may never play more than 3 cards in a single turn.</li>
                        <li><strong>Passing:</strong> You can pass if you cannot or do not want to play. Once you pass, you are out of the current trick permanently.</li>
                        <li><strong>Trick End:</strong> Once all active players except one have passed, the trick ends. The last player who played cards starts the next trick.</li>
                    </ul>

                    <h3 style={{ marginTop: '15px', borderBottom: '2px solid #000' }}>Season End & Scoring</h3>
                    <p>A season ends immediately when a player plays their last card (mid-trick ends the season). Points are awarded based on the order in which players go out:</p>
                    <ul>
                        <li>1st player out: <strong>+2 points</strong></li>
                        <li>2nd player out: <strong>+1 point</strong> (with 3+ players)</li>
                        <li>Last player with cards: <strong>-1 point</strong></li>
                    </ul>
                </div>
            </div>
        );
    }
}

interface MaskmenMainProps extends ViewPropsInterface {
    gameStatus: GameStatus;
    season: number;
    players: { [playerId: string]: any };
    playerIds: string[];
    currentPlayerId: string;
    lastTrickWinnerId: string | null;
    currentTrick: {
        leaderId: string;
        plays: PlayRecord[];
        passedPlayers: string[];
    };
    comparisonEdges: Array<[WrestlerColor, WrestlerColor]>;
    cumulativeCounts: { [key in WrestlerColor]: number };
    isHost: boolean;
    lastMove?: any;
    clientIds?: string[];
    names?: string[];
    accents?: string[];

    // Player specific props
    hand: WrestlerColor[];
    score: number;
    outOrder: number;
}

export function getSeasonPointsGained(outOrder: number, totalPlayers: number): number {
    if (outOrder === 1) return 2;
    if (totalPlayers === 2) {
        if (outOrder === 2) return -1;
    } else {
        if (outOrder === 2) return 1;
        if (outOrder === totalPlayers) return -1;
    }
    return 0;
}

export function findMaximalChains(edges: Array<[WrestlerColor, WrestlerColor]>): WrestlerColor[][] {
    const adj = new Map<WrestlerColor, WrestlerColor[]>();
    const inDegree = new Map<WrestlerColor, number>();

    const allColors = new Set<WrestlerColor>();
    for (const [stronger, weaker] of edges) {
        allColors.add(stronger);
        allColors.add(weaker);
    }

    for (const c of allColors) {
        adj.set(c, []);
        inDegree.set(c, 0);
    }

    for (const [stronger, weaker] of edges) {
        adj.get(weaker)!.push(stronger);
        inDegree.set(stronger, (inDegree.get(stronger) || 0) + 1);
    }

    const chains: WrestlerColor[][] = [];

    function dfs(curr: WrestlerColor, path: WrestlerColor[]) {
        const neighbors = adj.get(curr) || [];
        if (neighbors.length === 0) {
            if (path.length >= 2) {
                chains.push([...path]);
            }
            return;
        }
        for (const next of neighbors) {
            path.push(next);
            dfs(next, path);
            path.pop();
        }
    }

    for (const c of allColors) {
        if (inDegree.get(c) === 0) {
            dfs(c, [c]);
        }
    }

    return chains;
}

interface MaskmenViewState {
    selectedWrestler: WrestlerColor | null;
    selectedCount: number;
}

class MaskmenArenaView extends React.Component<MaskmenMainProps, MaskmenViewState> {
    constructor(props: MaskmenMainProps) {
        super(props);
        this.state = {
            selectedWrestler: null,
            selectedCount: 1
        };
    }

    componentDidUpdate(prevProps: MaskmenMainProps) {
        // Reset selection if turn changes
        if (prevProps.currentPlayerId !== this.props.currentPlayerId) {
            this.setState({ selectedWrestler: null, selectedCount: 1 });
        }
    }

    private selectWrestler(wrestler: WrestlerColor) {
        const { MP, currentPlayerId, currentTrick, players } = this.props;
        const myId = MP.clientId;
        const isMyTurn = myId === currentPlayerId;
        const hasPassed = currentTrick.passedPlayers.includes(myId);
        const amIOut = (players[myId]?.outOrder || 0) > 0;
        const has3CardsPlay = currentTrick.plays.some(p => p.cardCount === 3);

        if (!isMyTurn || hasPassed || amIOut || has3CardsPlay) {
            return;
        }

        const handCount = this.props.hand.filter(c => c === wrestler).length;

        // Find the first legal card count (1, 2, or 3)
        let firstLegalCount = 1;
        for (let count = 1; count <= 3; count++) {
            if (count <= handCount && this.checkPlayLegality(wrestler, count).legal) {
                firstLegalCount = count;
                break;
            }
        }

        this.setState({
            selectedWrestler: wrestler,
            selectedCount: firstLegalCount
        });
    }

    private selectCount(count: number) {
        this.setState({ selectedCount: count });
    }

    private checkPlayLegality(wrestler: WrestlerColor, count: number): { legal: boolean; error: string } {
        const plays = this.props.currentTrick.plays;
        const isFirstPlay = plays.length === 0;

        // Is it first trick of the season?
        const totalCumulativePlayed = Object.values(this.props.cumulativeCounts).reduce((a, b) => a + b, 0);
        const isFirstTrickOfSeason = totalCumulativePlayed === 0;

        if (isFirstPlay) {
            if (isFirstTrickOfSeason && count !== 1) {
                return { legal: false, error: 'First trick of a season must be led with exactly 1 card' };
            }
            return { legal: true, error: '' };
        }

        const lastPlay = plays[plays.length - 1];
        const prevWrestler = lastPlay.wrestler;
        const X = lastPlay.cardCount;

        if (wrestler === prevWrestler) {
            return { legal: false, error: 'Cannot play the same wrestler as the previous play' };
        }

        // Check if prevWrestler is transitively stronger than wrestler
        if (this.isStronger(prevWrestler, wrestler)) {
            return { legal: false, error: `${wrestler} is known to be weaker than ${prevWrestler}` };
        }

        const knownStronger = this.isStronger(wrestler, prevWrestler);

        if (knownStronger) {
            if (count < X) {
                return { legal: false, error: `Must play at least ${X} cards of ${wrestler} (known-stronger)` };
            }
            return { legal: true, error: '' };
        } else {
            if (count < X + 1) {
                return { legal: false, error: `Must play at least ${X + 1} cards to introduce/promote ${wrestler}` };
            }
            if (X === 3) {
                return { legal: false, error: 'Lead count is 3; cannot play X+1 cards (max is 3)' };
            }
            return { legal: true, error: '' };
        }
    }

    // Reachability helper
    private isStronger(u: WrestlerColor, v: WrestlerColor): boolean {
        if (u === v) return false;
        const counts = this.props.cumulativeCounts;
        if (counts[u] === counts[v]) return false;

        if (counts[u] > counts[v]) {
            // Compute reachability
            const adj = new Map<WrestlerColor, Set<WrestlerColor>>();
            const colors = Object.values(WrestlerColor);
            for (const c of colors) {
                adj.set(c, new Set<WrestlerColor>());
            }
            for (const [stronger, weaker] of this.props.comparisonEdges) {
                adj.get(stronger)!.add(weaker);
            }

            const visited = new Set<WrestlerColor>();
            const queue: WrestlerColor[] = [u];
            visited.add(u);

            while (queue.length > 0) {
                const curr = queue.shift()!;
                if (curr === v) return true;
                for (const neighbor of adj.get(curr)!) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
        }
        return false;
    }

    public render() {
        const { MP, players, playerIds, currentPlayerId, currentTrick, hand } = this.props;
        const { selectedWrestler, selectedCount } = this.state;

        const myId = MP.clientId;
        const isMyTurn = myId === currentPlayerId;
        const hasPassed = currentTrick.passedPlayers.includes(myId);
        const amIOut = players[myId]?.outOrder > 0;

        // Group hand by wrestler
        const handGroups: { [key in WrestlerColor]?: number } = {};
        hand.forEach(c => {
            handGroups[c] = (handGroups[c] || 0) + 1;
        });

        // Determine legal plays for selected wrestler
        let playError = '';
        let playIsLegal = false;
        if (selectedWrestler) {
            const validation = this.checkPlayLegality(selectedWrestler, selectedCount);
            playIsLegal = validation.legal;
            playError = validation.error;
        }

        const canPlay = isMyTurn && !hasPassed && !amIOut && playIsLegal;
        const showPassButton = isMyTurn && !hasPassed && !amIOut && currentTrick.plays.length > 0;
        const has3CardsPlay = currentTrick.plays.some(p => p.cardCount === 3);

        return (
            <div className="maskmen-arena" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div className="player-status-bar">
                    <div className={`turn-indicator ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
                        {amIOut ? (
                            <span>🎉 You are out! waiting...</span>
                        ) : hasPassed ? (
                            <span>💤 You passed this trick</span>
                        ) : isMyTurn ? (
                            <span>⚡ YOUR TURN TO PLAY ⚡</span>
                        ) : (
                            <span>
                                Waiting for {MP.getPluginView('lobby', 'player-tag', { clientId: currentPlayerId })}
                            </span>
                        )}
                    </div>
                </div>

                <div className="brutalist-panel trick-board">
                    <h3>Current Trick Board</h3>
                    <div className="trick-plays-list">
                        {currentTrick.plays.length === 0 ? (
                            <div style={{ color: '#666', fontStyle: 'italic' }}>Trick is empty. Play to lead!</div>
                        ) : (
                            currentTrick.plays.map((play, idx) => (
                                <div key={idx} className={`played-trick-card wrestler-${play.wrestler}`}>
                                    <div className="wrestler-name">{play.wrestler}</div>
                                    <div className="card-count-badge">🃏 {play.cardCount}</div>
                                    <div style={{ fontSize: '0.7em', marginTop: '4px', color: '#000' }}>
                                        {MP.getPluginView('lobby', 'player-name', { clientId: play.playerId })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#666' }}>
                        🚫 Passed players: {currentTrick.passedPlayers.map(id => MP.getPluginView('lobby', 'player-name', { clientId: id })).reduce((prev, curr) => [prev, ', ', curr] as any, null) || 'None'}
                    </div>
                </div>

                <div className="brutalist-panel">
                    <h3>Established Relationships</h3>
                    {this.props.comparisonEdges.length === 0 ? (
                        <p style={{ fontStyle: 'italic', color: '#666', margin: 0 }}>No wrestler relationships established yet.</p>
                    ) : (() => {
                        const chains = findMaximalChains(this.props.comparisonEdges);
                        return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                {chains.map((chain, chainIdx) => (
                                    <div key={chainIdx} className="relationship-pair">
                                        {chain.map((wrestler, idx) => (
                                            <React.Fragment key={idx}>
                                                {idx > 0 && <span className="relation-sign">{' < '}</span>}
                                                <span className={`wrestler-square wrestler-${wrestler}`} />
                                            </React.Fragment>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {/* Player's Hand / Selector */}
                <div className="brutalist-panel hand-zone">
                    <h3>Your Hand</h3>
                    {hand.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold' }}>
                            🎉 Hand is empty!
                        </div>
                    ) : (
                        <div>
                            <div className="cards-row">
                                {Object.entries(handGroups).map(([colorStr, count]) => {
                                    const wrestler = colorStr as WrestlerColor;
                                    const isSelected = selectedWrestler === wrestler;

                                    return (
                                        <div
                                            key={wrestler}
                                            className={`selector-card wrestler-${wrestler} ${isSelected ? 'selected' : ''}`}
                                            onClick={() => this.selectWrestler(wrestler)}
                                        >
                                            <div>{wrestler}</div>
                                            <span className="card-qty">x{count}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedWrestler ? (
                                <div style={{ borderTop: '2px solid #000', paddingTop: '15px', marginTop: '10px' }}>
                                    <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
                                        Number of cards to play:
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                        {[1, 2, 3].map(count => {
                                            const available = handGroups[selectedWrestler] || 0;
                                            const validation = this.checkPlayLegality(selectedWrestler, count);
                                            const disabled = count > available || !validation.legal;
                                            const active = selectedCount === count;

                                            return (
                                                <button
                                                    key={count}
                                                    disabled={disabled}
                                                    className={`brutalist-button ${active ? 'btn-primary' : ''}`}
                                                    style={{ padding: '8px 16px', minHeight: 'auto' }}
                                                    onClick={() => this.selectCount(count)}
                                                >
                                                    {count} Card{count > 1 ? 's' : ''}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {playError && (
                                        <div style={{ color: '#e74c3c', fontWeight: 'bold', marginBottom: '15px', fontSize: '0.9em' }}>
                                            ⚠️ {playError}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <button
                                            className="brutalist-button btn-play"
                                            disabled={!canPlay}
                                            onClick={() => MP.playCards(selectedWrestler, selectedCount)}
                                        >
                                            Play Cards
                                        </button>
                                        {showPassButton && (
                                            <button
                                                className={`brutalist-button btn-pass ${has3CardsPlay ? 'pulse' : ''}`}
                                                onClick={() => MP.passTurn()}
                                            >
                                                Pass
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                showPassButton && (
                                    <div style={{ borderTop: '2px solid #000', paddingTop: '15px', marginTop: '10px' }}>
                                        <button
                                            className={`brutalist-button btn-pass ${has3CardsPlay ? 'pulse' : ''}`}
                                            onClick={() => MP.passTurn()}
                                        >
                                            Pass
                                        </button>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

// Stats & Leaderboard View
class MaskmenStatsView extends React.Component<MaskmenMainProps, {}> {
    render() {
        const { MP, players, playerIds, currentPlayerId, currentTrick, gameStatus } = this.props;

        // Sorted leaderboard
        const sortedLeaderboard = [...playerIds].map(id => ({
            id,
            score: players[id].score,
            seasonsWon: players[id].seasonsWon
        })).sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return b.seasonsWon - a.seasonsWon;
        });

        return (
            <div style={{ padding: '15px', maxHeight: '100%', overflowY: 'auto', maxWidth: '600px', margin: '0 auto' }}>
                <div className="brutalist-panel">
                    <h2>Current Season</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        {playerIds.map(id => {
                            const p = players[id];
                            const isCurrent = gameStatus === GameStatus.Playing && id === currentPlayerId;
                            const hasPassedOpponent = gameStatus === GameStatus.Playing && currentTrick?.passedPlayers?.includes(id);

                            return (
                                <div
                                    key={id}
                                    style={{
                                        padding: '10px 14px',
                                        border: '3px solid #000',
                                        boxShadow: '4px 4px 0px #000',
                                        backgroundColor: isCurrent ? '#f1c40f' : '#fff',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold' }}>
                                        {MP.getPluginView('lobby', 'player-tag', { clientId: id })}
                                        {isCurrent && <span style={{ marginLeft: '8px' }}>⚡</span>}
                                    </div>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {p.outOrder > 0 ? (
                                            <span style={{ color: '#2ecc71' }}>OUT (#{p.outOrder})</span>
                                        ) : hasPassedOpponent ? (
                                            <span style={{ color: '#999' }}>PASSED</span>
                                        ) : (
                                            <span>🃏 x{p.hand.length}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="brutalist-panel">
                    <h2>Cumulative Leaderboard</h2>
                    <table className="leaderboard-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th>Belts 🏆</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedLeaderboard.map((item, idx) => (
                                <tr key={item.id}>
                                    <td>#{idx + 1}</td>
                                    <td>{MP.getPluginView('lobby', 'player-tag', { clientId: item.id })}</td>
                                    <td>{item.seasonsWon}</td>
                                    <td style={{ fontWeight: 'bold' }}>{item.score} pts</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

// Season End / GameOver Screens
class MaskmenSeasonEndScreen extends React.Component<MaskmenMainProps, {}> {
    render() {
        const { MP, players, playerIds, isHost, season } = this.props;

        // Sort players by their finish order in the current season
        const seasonStandings = [...playerIds].map(id => ({
            id,
            outOrder: players[id].outOrder,
            pointsGained: getSeasonPointsGained(players[id].outOrder, playerIds.length)
        })).sort((a, b) => a.outOrder - b.outOrder);

        return (
            <div className="maskmen-container" style={{ textAlign: 'center', padding: '30px' }}>
                <h2>📊 Season {season} Complete!</h2>
                <div className="brutalist-panel" style={{ textAlign: 'left', maxWidth: '600px', margin: '20px auto' }}>
                    <h3>Season Standing Details</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {seasonStandings.map((standing, idx) => {
                            const nameView = MP.getPluginView('lobby', 'player-tag', { clientId: standing.id });
                            const ptsStr = standing.pointsGained >= 0 ? `+${standing.pointsGained}` : `${standing.pointsGained}`;
                            return (
                                <div
                                    key={standing.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px 14px',
                                        border: '3px solid #000',
                                        boxShadow: '4px 4px 0px #000',
                                        backgroundColor: '#fff'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold' }}>
                                        #{idx + 1}: {nameView}
                                    </div>
                                    <div style={{ fontWeight: 'bold', color: standing.pointsGained > 0 ? '#2ecc71' : standing.pointsGained < 0 ? '#e74c3c' : '#000' }}>
                                        {ptsStr} pts {standing.outOrder === 1 ? '🏆' : ''}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {isHost ? (
                    <button
                        className="brutalist-button btn-primary"
                        onClick={() => MP.startNextSeason()}
                    >
                        Start Next Season 🚀
                    </button>
                ) : (
                    <div className="lobby-status">⏳ Waiting for Host to start next season...</div>
                )}
            </div>
        );
    }
}

class MaskmenGameOverScreen extends React.Component<MaskmenMainProps, {}> {
    render() {
        const { MP, players, playerIds, isHost } = this.props;

        const finalStandings = [...playerIds].map(id => ({
            id,
            score: players[id].score,
            seasonsWon: players[id].seasonsWon
        })).sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return b.seasonsWon - a.seasonsWon;
        });

        return (
            <div className="maskmen-container" style={{ textAlign: 'center', padding: '30px' }}>
                <h2>🏆 Game Over!</h2>
                <div className="brutalist-panel" style={{ textAlign: 'left', maxWidth: '600px', margin: '20px auto' }}>
                    <h3>Final Rankings</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {finalStandings.map((item, idx) => {
                            const nameView = MP.getPluginView('lobby', 'player-tag', { clientId: item.id });
                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        border: '4px solid #000',
                                        boxShadow: '5px 5px 0px #000',
                                        backgroundColor: idx === 0 ? '#f1c40f' : '#fff'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', fontSize: idx === 0 ? '1.2em' : '1.1em' }}>
                                        {idx === 0 ? '👑 ' : `#${idx + 1} `} {nameView}
                                    </div>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {item.score} pts ({item.seasonsWon} Belts 🏆)
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {isHost ? (
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
                        <button
                            className="brutalist-button btn-primary"
                            onClick={() => MP.restartGame()}
                        >
                            🔄 Play Again
                        </button>
                        <button
                            className="brutalist-button btn-pass"
                            onClick={() => MP.backToLobby()}
                        >
                            🏠 Lobby
                        </button>
                    </div>
                ) : (
                    <div className="lobby-status">⏳ Waiting for Host to restart...</div>
                )}
            </div>
        );
    }
}

// Master component selector
function MainPage(props: MaskmenMainProps) {
    switch (props.gameStatus) {
        case GameStatus.Playing:
            return <MaskmenArenaView {...props} />;
        case GameStatus.SeasonEnd:
            return <MaskmenSeasonEndScreen {...props} />;
        case GameStatus.GameOver:
            return <MaskmenGameOverScreen {...props} />;
        default:
            return <div>Loading...</div>;
    }
}

export class MaskmenMainPage extends React.Component<MaskmenMainProps, {}> {
    public render() {
        const mp = this.props.MP;

        // Build Toast Notifications from last move
        let toastNotification = null;
        if (this.props.lastMove) {
            const lastMove = this.props.lastMove;
            const idx = this.props.clientIds ? this.props.clientIds.indexOf(lastMove.playerId) : -1;
            const playerName = mp.getPluginView('lobby', 'player-name', { clientId: lastMove.playerId });
            const playerColor = (idx !== -1 && this.props.accents?.[idx]) || '#2c3e50';

            let msg = '';
            let sound = PassSound;

            if (lastMove.action === 'play') {
                msg = `${lastMove.cardCount}x ${lastMove.wrestler} cards played`;
                sound = CardSound;
            } else if (lastMove.action === 'pass') {
                msg = `passed`;
                sound = PassSound;
            } else if (lastMove.action === 'startSeason') {
                msg = `leads the new season`;
                sound = SuccessSound;
            }

            const text = (
                <span>
                    {playerName} {msg}
                </span>
            ) as any;

            toastNotification = {
                id: lastMove.moveId,
                message: text,
                bgColor: playerColor,
                sound,
                duration: 5000
            };
        }

        const links = {
            'home': {
                'icon': 'gamepad',
                'label': 'Arena',
                'view': MainPage(this.props)
            },
            'stats': {
                'icon': 'list',
                'label': 'Leaderboard',
                'view': <MaskmenStatsView {...this.props} />
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <MaskmenRulesView />
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Settings',
                'view': (
                    <div style={{ padding: '20px' }}>
                        <button
                            className="brutalist-button btn-pass"
                            style={{ width: '100%', marginBottom: '15px' }}
                            onClick={() => this.props.MP.restartGame()}
                        >
                            Restart Game
                        </button>
                        <button
                            className="brutalist-button"
                            style={{ width: '100%', backgroundColor: '#eee' }}
                            onClick={() => this.props.MP.backToLobby()}
                        >
                            Back to Lobby
                        </button>
                    </div>
                )
            };
        }

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': links,
                'gameName': 'Maskmen',
                'topBarContent': this.props.gameStatus === GameStatus.Playing
                    ? `Season ${this.props.season}`
                    : this.props.gameStatus === GameStatus.SeasonEnd
                        ? '📊'
                        : '🏆',
                'toastNotification': toastNotification
            });
    }
}
