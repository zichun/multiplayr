/**
 * StartupsViews.tsx - React components for Startups game
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { StartupsGameRules } from './StartupsRules';
import { GameStatus, Company, COMPANIES, COMPANY_COLORS, COMPANY_COUNTS } from '../StartupsGameState';

// Lobby Views
export class StartupsHostLobby extends React.Component<ViewPropsInterface, {}> {
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
                        'view': StartupsGameRules
                    }
                }
            }
        );
    }
}

export class StartupsClientLobby extends React.Component<ViewPropsInterface, {}> {
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
                        'view': StartupsGameRules
                    }
                }
            });
    }
}

// Main Coordinator View
interface StartupsMainViewProps extends ViewPropsInterface {
    gameStatus: GameStatus;
    deckCount: number;
    market: Array<{ id: string; company: Company; coins: number }>;
    players: { [playerId: string]: any };
    playerIds: string[];
    currentPlayerId: string;
    antiMonopolyTokens: { [key in Company]?: string | null };
    scoringCompanyIndex: number;
    scoringLogs: string[];
    isHost: boolean;
    lastTakenFromMarketCompany: Company | null;

    // Player specific props
    hand: Company[];
    portfolio: { [key in Company]?: number };
    coins1: number;
    coins3: number;
}

function MainPage(props: StartupsMainViewProps) {
    switch (props.gameStatus) {
        case GameStatus.ActionPhase:
        case GameStatus.DiscardOrInvestPhase: {
            return <StartupsGameScreen {...props} />;
        }
        case GameStatus.ScoringPhase: {
            return <StartupsScoringScreen {...props} />;
        }
        case GameStatus.GameOver: {
            return <StartupsGameOverScreen {...props} />;
        }
        default:
            return <div>Loading...</div>;
    }
}

// Game Board Interface
class StartupsGameScreen extends React.Component<StartupsMainViewProps, {}> {
    render() {
        const {
            MP,
            deckCount,
            market,
            players,
            playerIds,
            currentPlayerId,
            antiMonopolyTokens,
            gameStatus,
            hand,
            coins1,
            isHost
        } = this.props;

        const myId = MP.clientId;
        const isMyTurn = myId === currentPlayerId;

        let drawCost = 0;
        market.forEach(card => {
            const isExempt = antiMonopolyTokens[card.company] === myId;
            if (!isExempt) drawCost++;
        });
        const canAffordDraw = coins1 >= drawCost;

        return (
            <div className="startups-game-container">
                {/* 1. Header: Turn indicator & Own stats */}
                <div className="game-header-bar">
                    <div className="turn-indicator">
                        {isMyTurn ? (
                            <span className="my-turn-badge">⚡ YOUR TURN ⚡</span>
                        ) : (
                            <span className="other-turn-badge">
                                Waiting for {MP.getPluginView('lobby', 'player-tag', { clientId: currentPlayerId })}
                            </span>
                        )}
                        <div className="phase-subtitle">
                            {gameStatus === GameStatus.ActionPhase
                                ? "Draw a card from the Deck or Take one from the Market"
                                : "Invest in your portfolio or Discard to the Market"}
                        </div>
                    </div>

                    <div className="my-stats-container">
                        <div className="stat-pill coins" title="1-Coins (points)">
                            🪙 <span className="stat-val">{coins1}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Playing Arena (Deck and Market) */}
                <div className="arena-grid">
                    {/* Draw Deck Zone */}
                    <div
                        className={`deck-zone ${isMyTurn && gameStatus === GameStatus.ActionPhase && canAffordDraw ? 'active-clickable' : ''} ${isMyTurn && gameStatus === GameStatus.ActionPhase && !canAffordDraw ? 'forced-market-only' : ''}`}
                        style={isMyTurn && gameStatus === GameStatus.ActionPhase && !canAffordDraw ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                        onClick={() => {
                            if (isMyTurn && gameStatus === GameStatus.ActionPhase && canAffordDraw) {
                                MP.drawFromDeck();
                            }
                        }}
                    >
                        <div className="deck-card-visual">
                            <div className="deck-logo">STARTUPS</div>
                            <div className="cards-remaining">📦 {deckCount} cards left</div>
                        </div>
                        <div className="deck-action-hint" style={isMyTurn && gameStatus === GameStatus.ActionPhase && !canAffordDraw ? { color: '#e74c3c', fontWeight: 'bold' } : {}}>
                            {isMyTurn && gameStatus === GameStatus.ActionPhase
                                ? (canAffordDraw ? "Click to Draw" : `⚠️ Must Take from Market! (Cost: ${drawCost} 🪙, You have: ${coins1} 🪙)`)
                                : "Draw Deck"}
                        </div>
                    </div>

                    {/* Market Zone */}
                    <div className="market-zone">
                        <h3>The Market</h3>
                        {market.length === 0 ? (
                            <div className="empty-market-placeholder">
                                Market is currently empty.
                            </div>
                        ) : (
                            <div className="market-cards-grid">
                                {market.map((card) => {
                                    const isExempt = antiMonopolyTokens[card.company] === myId;
                                    const canTake = isMyTurn && gameStatus === GameStatus.ActionPhase && !isExempt;

                                    return (
                                        <div
                                            key={card.id}
                                            className={`market-card-item ${canTake ? 'clickable' : ''} ${isExempt ? 'blocked-by-antimonopoly' : ''}`}
                                            style={{ borderColor: COMPANY_COLORS[card.company] }}
                                            onClick={() => {
                                                if (canTake) {
                                                    MP.takeFromMarket(card.id);
                                                }
                                            }}
                                        >
                                            <div className="card-company-label" style={{ backgroundColor: COMPANY_COLORS[card.company] }}>
                                                {card.company}
                                            </div>
                                            <div className="market-coin-badge">
                                                🪙 {card.coins}
                                            </div>
                                            {isExempt && (
                                                <div className="antimonopoly-exempt-shield" title="You hold the Anti-Monopoly token. Cannot take this card!">
                                                    🛡️ Exempt
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Portfolios Grid */}
                <div className="portfolios-section">
                    <h3>Public Portfolios</h3>
                    <div className="portfolios-grid">
                        {playerIds.map((id) => {
                            const pState = players[id];
                            if (!pState) return null;
                            const isCurrent = id === currentPlayerId;

                            return (
                                <div key={id} className={`portfolio-card ${id === myId ? 'is-self' : ''} ${isCurrent ? 'is-active-turn' : ''}`}>
                                    <div className="portfolio-player-tag">
                                        {MP.getPluginView('lobby', 'player-tag', { clientId: id })}
                                        {id === myId && <span className="you-label">(You)</span>}
                                    </div>
                                    <div className="portfolio-stats-line">
                                        <span>🪙 {pState.coins1}</span>
                                    </div>
                                    <div className="portfolio-shares-list">
                                        {COMPANIES.map((company) => {
                                            const count = pState.portfolio[company] || 0;
                                            if (count === 0) return null;
                                            const holdsToken = antiMonopolyTokens[company] === id;

                                            return (
                                                <div
                                                    key={company}
                                                    className="share-badge"
                                                    style={{ borderLeftColor: COMPANY_COLORS[company] }}
                                                >
                                                    <span className="company-dot" style={{ backgroundColor: COMPANY_COLORS[company] }}></span>
                                                    <span className="share-name">{company.split(' ')[0]}</span>
                                                    <span className="share-count">{count}</span>
                                                    {holdsToken && (
                                                        <span className="antimonopoly-star" title="Anti-Monopoly Token Holder!">🏆</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {Object.keys(pState.portfolio).length === 0 && (
                                            <div className="no-shares-yet">No shares invested yet.</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 4. Hand Display & Turn Actions */}
                <div className="hand-section">
                    <h3>Your Hand ({hand.length} cards)</h3>
                    <div className="hand-cards-list">
                        {hand.map((company, index) => {
                            const showActions = isMyTurn && gameStatus === GameStatus.DiscardOrInvestPhase;
                            // Enforce same company discard restriction
                            const isRestrictedDiscard = company === this.props.lastTakenFromMarketCompany;

                            return (
                                <div
                                    key={index}
                                    className="hand-card-item"
                                    style={{ borderColor: COMPANY_COLORS[company] }}
                                >
                                    <div className="hand-card-color-strip" style={{ backgroundColor: COMPANY_COLORS[company] }}></div>
                                    <div className="hand-card-name">{company}</div>
                                    <div className="hand-card-info">Cards total: {COMPANY_COUNTS[company]}</div>

                                    {showActions && (
                                        <div className="hand-card-actions">
                                            <button
                                                className="btn-invest"
                                                onClick={() => MP.investCard(company)}
                                            >
                                                📈 Invest
                                            </button>
                                            <button
                                                className="btn-discard"
                                                disabled={isRestrictedDiscard}
                                                title={isRestrictedDiscard ? "Cannot discard same company you took from Market this turn" : ""}
                                                onClick={() => MP.discardCard(company)}
                                            >
                                                🗑️ Discard
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }
}

// Step-by-step scoring screen
class StartupsScoringScreen extends React.Component<StartupsMainViewProps, {}> {
    render() {
        const { MP, scoringCompanyIndex, scoringLogs, isHost, players, playerIds } = this.props;
        const currentCompany = COMPANIES[scoringCompanyIndex];
        const nextCompany = COMPANIES[scoringCompanyIndex + 1];

        return (
            <div className="startups-scoring-container">
                <h2>📊 End Game Scoring</h2>
                <p className="scoring-intro">All hands have been revealed and added to portfolios. Let&apos;s score each company from smallest to largest!</p>

                {/* Step indicators */}
                <div className="scoring-steps-bar">
                    {COMPANIES.map((company, idx) => {
                        let stepClass = "step-node";
                        if (idx < scoringCompanyIndex) stepClass += " done";
                        else if (idx === scoringCompanyIndex) stepClass += " active";

                        return (
                            <div key={company} className={stepClass} style={{ borderBottomColor: COMPANY_COLORS[company] }}>
                                <div className="step-dot" style={{ backgroundColor: COMPANY_COLORS[company] }}></div>
                                <span className="step-label">{company.split(' ')[0]} ({COMPANY_COUNTS[company]})</span>
                            </div>
                        );
                    })}
                </div>

                <div className="scoring-arena">
                    {scoringCompanyIndex < COMPANIES.length ? (
                        <div className="current-company-scoring-card" style={{ borderColor: COMPANY_COLORS[currentCompany] }}>
                            <div className="scoring-company-header" style={{ backgroundColor: COMPANY_COLORS[currentCompany] }}>
                                🪙 Scoring: {currentCompany} ({COMPANY_COUNTS[currentCompany]} cards total)
                            </div>

                            <div className="player-shares-comparison">
                                <h4>Share Distributions:</h4>
                                <div className="shares-table">
                                    {playerIds.map(id => {
                                        const count = players[id]?.portfolio[currentCompany] || 0;
                                        return (
                                            <div key={id} className="shares-row">
                                                <span className="player-name-tag">{MP.getPluginView('lobby', 'player-tag', { clientId: id })}</span>
                                                <span className="shares-count-badge" style={{ backgroundColor: count > 0 ? COMPANY_COLORS[currentCompany] : '#ccc' }}>
                                                    {count} shares
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="scoring-done-card">
                            🎉 All companies have been scored! Proceed to final standings.
                        </div>
                    )}

                    {/* Scoring logs list */}
                    <div className="scoring-logs-box">
                        <h3>Scoring Transactions</h3>
                        {scoringLogs.length === 0 ? (
                            <p style={{ color: '#888' }}>Ready to score companies...</p>
                        ) : (
                            <div className="logs-scroller">
                                {scoringLogs.map((log, index) => (
                                    <div key={index} className="log-line-item">
                                        {log.split('\n').map((line, lIdx) => (
                                            <div key={lIdx} className={line.startsWith('---') ? 'log-company-header' : 'log-transaction'}>
                                                {line}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {isHost && (
                    <button
                        className="btn-next-scoring"
                        onClick={() => MP.nextScoringCompany()}
                    >
                        {nextCompany ? `Score Next Company (${nextCompany.split(' ')[0]}) ➡️` : "View Final Standings 🏆"}
                    </button>
                )}
                {!isHost && (
                    <div className="waiting-for-host-scoring">
                        Waiting for Host to step through scoring...
                    </div>
                )}
            </div>
        );
    }
}

// Final Game Over Leaderboard Screen
class StartupsGameOverScreen extends React.Component<StartupsMainViewProps, {}> {
    render() {
        const { MP, players, playerIds, isHost } = this.props;

        // Calculate scores
        const playerScores = playerIds.map(id => {
            const pState = players[id];
            const score = pState.coins1 * 1 + pState.coins3 * 3;
            return {
                id,
                name: id,
                coins1: pState.coins1,
                coins3: pState.coins3,
                totalScore: score
            };
        });

        // Sort in descending order
        playerScores.sort((a, b) => b.totalScore - a.totalScore);
        const winningScore = playerScores[0]?.totalScore;

        return (
            <div className="startups-gameover-container">
                <div className="trophy-banner">🎉 GAME OVER 🎉</div>
                <h2>Leaderboard</h2>

                <div className="leaderboard-list">
                    {playerScores.map((scoreCard, index) => {
                        const isWinner = scoreCard.totalScore === winningScore;
                        let rankClass = "rank-item";
                        if (index === 0) rankClass += " rank-first";

                        return (
                            <div key={scoreCard.id} className={rankClass}>
                                <div className="rank-left">
                                    <span className="rank-num">#{index + 1}</span>
                                    <span className="rank-player-tag">
                                        {MP.getPluginView('lobby', 'player-tag', { clientId: scoreCard.id })}
                                        {isWinner && <span className="winner-crown"> 👑 Winner</span>}
                                    </span>
                                </div>

                                <div className="rank-breakdown">
                                    <div className="breakdown-details">
                                        <span title="1-Coins">🪙 {scoreCard.coins1} × 1</span> +
                                        <span title="3-Coins"> 🌟 {scoreCard.coins3} × 3</span>
                                    </div>
                                    <div className="rank-score-val">
                                        {scoreCard.totalScore} pts
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {isHost ? (
                    <div className="gameover-controls">
                        <button
                            className="btn-restart"
                            onClick={() => MP.restartGame()}
                        >
                            🔄 Start New Game
                        </button>
                        <button
                            className="btn-lobby"
                            onClick={() => MP.backToLobby()}
                        >
                            🏠 Back to Lobby
                        </button>
                    </div>
                ) : (
                    <div className="waiting-for-host-gameover">
                        Waiting for Host to start a new game...
                    </div>
                )}
            </div>
        );
    }
}

export class StartupsMainPage extends React.Component<StartupsMainViewProps, {}> {
    public render() {
        const mp = this.props.MP;

        const links = {
            'home': {
                'icon': 'gamepad',
                'label': 'Startups',
                'view': MainPage(this.props)
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': StartupsGameRules
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Settings',
                'view': (
                    <div style={{ padding: '20px' }}>
                        <button
                            className="btn-settings-item"
                            style={{
                                background: '#e74c3c',
                                color: 'white',
                                border: '4px solid #000',
                                padding: '12px 24px',
                                fontSize: '1.1em',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                width: '100%',
                                marginBottom: '15px'
                            }}
                            onClick={() => this.props.MP.restartGame()}
                        >
                            Restart Game
                        </button>
                        <button
                            className="btn-settings-item"
                            style={{
                                background: '#95a5a6',
                                color: 'white',
                                border: '4px solid #000',
                                padding: '12px 24px',
                                fontSize: '1.1em',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                width: '100%'
                            }}
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
                'gameName': '',
                'topBarContent': this.props.gameStatus === GameStatus.ScoringPhase
                    ? '📊'
                    : this.props.gameStatus === GameStatus.GameOver
                        ? '🏆'
                        : `🪙x${this.props.coins1}`
            });
    }
}
