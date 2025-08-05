/**
 * CatchSketchViews.tsx - React views for Catch Sketch game
 */

import * as React from 'react';
import { ViewPropsInterface, MPType } from '../../../common/interfaces';
import { CanvasRenderer } from '../../drawing/CanvasRenderer';
import { CatchSketchRule } from './CatchSketchRule';

// Use lobby views for now, we'll import the proper components later
export class CatchSketchHostLobby extends React.Component<ViewPropsInterface, {}> {
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
                        'view': mp.getPluginView('lobby', 'LobbyWithHostName')
                    },
                    'clients': {
                        'icon': 'users',
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': CatchSketchRule
                    }
                }
            }
        );
    }
}

export class CatchSketchClientLobby extends React.Component<ViewPropsInterface, {}> {
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
                        'view': mp.getPluginView('lobby', 'SetName')
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': CatchSketchRule
                    }
                }
        });
    }
}

interface CatchSketchMainPageProps extends ViewPropsInterface {
    round: number;
    currentGuesser: string;
    isGuesser: boolean;
    isHost: boolean;
    scores: { [playerId: string]: number };
    tokensClaimed: number;
    turnOrder: string[];
    guesses: Array<{ playerId: string; guess: string; isCorrect: boolean }>;
    currentDrawingPlayer: string | null;
    isDrawingPhase: boolean;
    isGuessingPhase: boolean;
    isReviewPhase: boolean;
    playerData: any;
    secretWord: string;
    hostCanvas: any;
    allCanvases: { [playerId: string]: any };
    currentCanvas: any;
    tokenOwnership: { [token: number]: string | null };
    roundStartTime: number;
    firstTokenTime: number;
    tokenTimeout: number;
}

export class CatchSketchScoresView extends React.Component<CatchSketchMainPageProps, {}> {
    private renderPlayerTag(playerId: string) {
        return this.props.MP.getPluginView('lobby', 'player-tag', { clientId: playerId });
    }
    private backToLobby = () => {
        this.props.MP.backToLobby();
    }
    public render() {
        const { scores, isHost } = this.props;

        // Convert scores object to an array of [playerId, score] pairs and sort by score descending
        const sortedEntries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const topscore = Math.max(1, sortedEntries[0][1]);
        return (
            <div className="catchsketch-scores">
            <h1>Scores</h1>
            <div className="scores-list">
            {sortedEntries.map(([playerId, score]) => (
                <div key={playerId} className="score-item">
                    <div className="player-name">{this.renderPlayerTag(playerId)}</div>
                    <div className="player-score">{score === topscore && (<span>👑</span>)} {score}</div>
                </div>
            ))}
            </div>

            {isHost && (<div className="next-round">
                <button onClick={this.backToLobby}>Back to Lobby</button>
            </div>)}

            </div>
        );
    }
}

export class CatchSketchMainView extends React.Component<CatchSketchMainPageProps, { guessInput: string }> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'gameName': 'Round ' + (this.props.round + 1),
                'links': {
                    'home': {
                        'icon': 'pen',
                        'label': 'CatchSketch',
                        'view': React.createElement(CatchSketchMainComponent, this.props)
                    },
                    'clients': {
                        'icon': 'users',
                        'label': 'Players',
                        'view': React.createElement(CatchSketchScoresView, this.props)
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': CatchSketchRule
                    }
                }
            }
        );
    }
}

export class CatchSketchMainComponent extends React.Component<CatchSketchMainPageProps, { guessInput: string }> {
    constructor(props: CatchSketchMainPageProps) {
        super(props);
        this.state = { guessInput: '' };
    }

    private lockToken = (tokenNumber: 1 | 2) => {
        this.props.MP.lockToken(tokenNumber);
    }

    private submitGuess = () => {
        if (this.state.guessInput.trim()) {
            this.props.MP.submitGuess(this.state.guessInput.trim());
            this.setState({ guessInput: '' });
        }
    }

    private nextRound = () => {
        this.props.MP.nextRound();
    }

    private handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            this.submitGuess();
        }
    }

    private renderTokens() {
        const { isGuesser, playerData } = this.props;

        const token1Claimed = this.getTokenOwner(1);
        const token2Claimed = this.getTokenOwner(2);

        return (
            <div className="tokens-section">
                <div className="tokens">
                    <div
                        className={`token token-1 ${token1Claimed ? 'claimed' : ''} ${playerData?.hasLocked ? 'disabled' : ''}`}
                        onClick={() => !isGuesser && !token1Claimed && !playerData?.hasLocked && this.lockToken(1)}
                    >
                        {token1Claimed ? (
                            <div>
                                <div className="player-name">{this.renderPlayerTag(token1Claimed)}</div>
                            </div>
                        ) : '1'}
                    </div>
                    <div
                        className={`token token-2 ${token2Claimed ? 'claimed' : ''} ${playerData?.hasLocked ? 'disabled' : ''}`}
                        onClick={() => !isGuesser && !token2Claimed && !playerData?.hasLocked && this.lockToken(2)}
                    >
                        {token2Claimed ? (
                            <div>
                                <div className="player-name">{this.renderPlayerTag(token2Claimed)}</div>
                            </div>
                        ) : '2'}
                    </div>
                </div>
            </div>
        );
    }

    private getTokenOwner(tokenNumber: number): string | null {
        return this.props.tokenOwnership[tokenNumber] || null;
    }

    private getPlayerName(playerId: string): string {
        // Use player-tag component from lobby plugin
        return playerId.substring(0, 8); // Fallback
    }

    private renderPlayerTag(playerId: string) {
        return this.props.MP.getPluginView('lobby', 'player-tag', { clientId: playerId });
    }

    private renderDrawingArea() {
        const { isGuesser } = this.props;

        if (isGuesser) {
            return null; // Guesser doesn't draw
        }

        const DrawingView = this.props.MP.getPluginView('drawing', 'DrawingView');

        return (
            <div className="drawing-area">
                {DrawingView}
            </div>
        );
    }

    private renderTurnOrder() {
        const { turnOrder, currentDrawingPlayer, guesses } = this.props;
        const players = turnOrder.length;
        return (
            <div className="turn-order">
                <div className="players-list">
                    {turnOrder.map((playerId, index) => {
                        const isCurrent = playerId === currentDrawingPlayer;
                        const isCompleted = index < guesses.length;

                        return (
                            <div className="turn-container">
                                <div
                                    key={playerId}
                                    className={`player-item ${isCurrent ? 'current-player' : ''} ${isCompleted ? 'completed' : ''}`}
                                >
                                    <div className="player-tag-container">{this.renderPlayerTag(playerId)}</div>
                                    <div className="turn-number">#{index + 1}</div>
                                </div>
                                {index < players - 1 && (<div className="right-arrow">⇢
                                </div>)}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    private renderCurrentDrawing() {
        const { currentDrawingPlayer, allCanvases } = this.props;

        if (!currentDrawingPlayer || !allCanvases[currentDrawingPlayer]) {
            return null;
        }

        return (
            <div className="current-drawing">
                <div className="drawing-display">
                    {React.createElement(CanvasRenderer, {
                        canvas: allCanvases[currentDrawingPlayer],
                        width: 400,
                        height: 300
                    })}
                </div>
            </div>
        );
    }

    private renderGuessInput() {
        const { isGuesser } = this.props;

        if (!isGuesser) {
            return null;
        }

        return (
            <div className="guess-input">
                <div className="input-group">
                    <input
                        type="text"
                        value={this.state.guessInput}
                        onChange={(e) => this.setState({ guessInput: e.target.value })}
                        onKeyPress={this.handleKeyPress}
                        placeholder="Enter your guess..."
                    />
                    <button
                        onClick={this.submitGuess}
                        disabled={!this.state.guessInput.trim()}
                    >
                        Guess!
                    </button>
                </div>
            </div>
        );
    }

    private renderPreviousGuesses() {
        const { guesses } = this.props;

        if (guesses.length === 0) {
            return null;
        }

        return (
            <div className="previous-guesses">
                <h4>Previous Guesses</h4>
                {guesses.map((guess, index) => (
                    <div key={index} className={`guess-item ${guess.isCorrect ? 'correct' : 'incorrect'}`}>
                        <span className="guess-icon">{guess.isCorrect ? '✓' : '✗'}</span>
                        <span className="guess-text">&quot;{guess.guess}&quot;</span>
                    </div>
                ))}
            </div>
        );
    }

    private renderAllDrawings() {
        const { turnOrder, allCanvases, guesses } = this.props;

        return (
            <div className="all-drawings">
                <div className="drawings-grid">
                    {turnOrder.map((playerId, index) => {
                        let guess = null;
                        if (index < guesses.length) {
                            guess = guesses[index];
                        }
                        return (<div key={playerId} className="drawing-item">
                            <div className="player-header">
                                <div className="player-tag-container">{this.renderPlayerTag(playerId)}</div>
                            </div>
                            {guess && (<div className={`guess-item ${guess.isCorrect ? 'correct' : 'incorrect'}`}>
                                <span className="guess-icon">{guess.isCorrect ? '✓' : '✗'}</span>
                                <span className="guess-text">&quot;{guess.guess}&quot;</span>
                            </div>
                            )}
                            {allCanvases[playerId] && React.createElement(CanvasRenderer, {
                                canvas: allCanvases[playerId],
                                width: 400,
                                height: 300
                            })}
                        </div>
                    )})}
                </div>
            </div>
        );
    }

    public render() {
        const {
            isGuesser,
            secretWord,
            isDrawingPhase,
            isGuessingPhase,
            isReviewPhase,
            playerData,
            tokensClaimed
        } = this.props;

        const roundTimer = React.createElement(CatchSketchRoundTimer, this.props);

        return (
            <div className="catch-sketch">
                <div className="game-header">
                    {isGuesser && <div className="guesser-info"><h3>You are the Guesser!</h3></div>}
                    {secretWord && (
                        <div className="secret-word">Secret Word: <strong>{secretWord}</strong></div>
                    )}
                </div>

                {isDrawingPhase && (
                    <div className="drawing-phase">
                        {this.renderTokens()}
                        {!playerData?.hasLocked && this.renderDrawingArea()}
                        {tokensClaimed === 1 && roundTimer}
                    </div>
                )}

                {isGuessingPhase && (
                    <div className="guessing-phase">
                        {this.renderTurnOrder()}
                        {this.renderGuessInput()}
                        {this.renderCurrentDrawing()}
                        {this.renderPreviousGuesses()}
                    </div>
                )}

                {isReviewPhase && (
                    <div className="review-phase">
                        {this.renderAllDrawings()}
                        <div className="next-round">
                            <button onClick={this.nextRound}>Next Round</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

export class CatchSketchRoundTimer extends React.Component<CatchSketchMainPageProps, {time: number}> {
    private interval: any;

    constructor(props){
        super(props);
        this.state = { time: Date.now() };
    }
    public componentDidMount() {
      this.interval = setInterval(() => this.setState({ time: Date.now() }), 1000);
    }
    public componentWillUnmount() {
        clearInterval(this.interval);
    }
    public render() {
        const time_left = Math.max(0, Math.round((this.props.tokenTimeout + this.props.firstTokenTime - this.state.time) / 1000));
        return (<div className="catchsketch-round-elapsed">Ending in <strong>{time_left}s</strong></div>);
    }
}
