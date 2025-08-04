/**
 * CatchSketchViews.tsx - React views for Catch Sketch game
 */

import * as React from 'react';
import { ViewPropsInterface, MPType } from '../../../common/interfaces';

// Use lobby views for now, we'll import the proper components later
export class CatchSketchHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const LobbyView = this.props.MP.getPluginView('lobby', 'LobbyView');
        return React.createElement(LobbyView, {
            ...this.props,
            gameName: 'Catch Sketch',
            minPlayers: 3,
            startGameMethod: 'startGame'
        });
    }
}

export class CatchSketchClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const LobbySetNameView = this.props.MP.getPluginView('lobby', 'LobbySetNameView');
        return React.createElement(LobbySetNameView, this.props);
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
}

export class CatchSketchMainPage extends React.Component<CatchSketchMainPageProps, { guessInput: string }> {
    constructor(props: CatchSketchMainPageProps) {
        super(props);
        this.state = { guessInput: '' };
    }

    private lockToken = (tokenNumber: 1 | 2) => {
        this.props.MP.callMethod('lockToken', tokenNumber);
    }

    private submitGuess = () => {
        if (this.state.guessInput.trim()) {
            this.props.MP.callMethod('submitGuess', this.state.guessInput.trim());
            this.setState({ guessInput: '' });
        }
    }

    private nextRound = () => {
        this.props.MP.callMethod('nextRound');
    }

    private handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            this.submitGuess();
        }
    }

    private renderTokens() {
        const { tokensClaimed, isGuesser, playerData } = this.props;
        
        if (isGuesser) {
            return null; // Guesser doesn't see tokens
        }

        const token1Claimed = this.getTokenOwner(1);
        const token2Claimed = this.getTokenOwner(2);
        
        return (
            <div className="tokens-section">
                <h3>Grab a Token!</h3>
                <div className="tokens">
                    <div 
                        className={`token token-1 ${token1Claimed ? 'claimed' : ''} ${playerData?.hasLocked ? 'disabled' : ''}`}
                        onClick={() => !token1Claimed && !playerData?.hasLocked && this.lockToken(1)}
                    >
                        {token1Claimed ? (
                            <div>
                                <div>1</div>
                                <div className="player-name">{this.getPlayerName(token1Claimed)}</div>
                            </div>
                        ) : '1'}
                    </div>
                    <div 
                        className={`token token-2 ${token2Claimed ? 'claimed' : ''} ${playerData?.hasLocked ? 'disabled' : ''}`}
                        onClick={() => !token2Claimed && !playerData?.hasLocked && this.lockToken(2)}
                    >
                        {token2Claimed ? (
                            <div>
                                <div>2</div>
                                <div className="player-name">{this.getPlayerName(token2Claimed)}</div>
                            </div>
                        ) : '2'}
                    </div>
                </div>
            </div>
        );
    }

    private getTokenOwner(tokenNumber: number): string | null {
        // This would need access to all player data - simplified for now
        return null; // Will be implemented when we have access to all player states
    }

    private getPlayerName(playerId: string): string {
        // Simplified - would get from lobby data
        return playerId.substring(0, 8);
    }

    private renderDrawingArea() {
        const { isGuesser, currentCanvas } = this.props;
        
        if (isGuesser) {
            return null; // Guesser doesn't draw
        }

        const DrawingView = this.props.MP.getPluginView('drawing', 'DrawingView');
        
        return (
            <div className="drawing-area">
                <h3>Draw the secret word!</h3>
                {React.createElement(DrawingView, {
                    ...this.props,
                    canvas: currentCanvas
                })}
            </div>
        );
    }

    private renderTurnOrder() {
        const { turnOrder, currentDrawingPlayer, guesses } = this.props;
        
        return (
            <div className="turn-order">
                <h3>Turn Order</h3>
                <div className="players-list">
                    {turnOrder.map((playerId, index) => {
                        const isCurrent = playerId === currentDrawingPlayer;
                        const isCompleted = index < guesses.length;
                        
                        return (
                            <div 
                                key={playerId} 
                                className={`player-item ${isCurrent ? 'current-player' : ''} ${isCompleted ? 'completed' : ''}`}
                            >
                                {this.getPlayerName(playerId)} (#{index + 1})
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

        const CanvasDisplay = this.props.MP.getPluginView('drawing', 'CanvasDisplay');
        
        return (
            <div className="current-drawing">
                <h3>Current Drawing: {this.getPlayerName(currentDrawingPlayer)}</h3>
                <div className="drawing-display">
                    {React.createElement(CanvasDisplay, {
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
                <h3>Make Your Guess!</h3>
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
                        Submit Guess
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
        const { turnOrder, allCanvases } = this.props;
        
        const CanvasDisplay = this.props.MP.getPluginView('drawing', 'CanvasDisplay');
        
        return (
            <div className="all-drawings">
                <h3>All Drawings</h3>
                <div className="drawings-grid">
                    {turnOrder.map((playerId, index) => (
                        <div key={playerId} className="drawing-item">
                            <h4>{this.getPlayerName(playerId)}</h4>
                            <div className="order-info">Turn #{index + 1}</div>
                            {allCanvases[playerId] && React.createElement(CanvasDisplay, {
                                canvas: allCanvases[playerId],
                                width: 250,
                                height: 200
                            })}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    private renderScores() {
        const { scores } = this.props;
        
        return (
            <div className="scores">
                <h3>Scores</h3>
                <div className="scores-list">
                    {Object.entries(scores).map(([playerId, score]) => (
                        <div key={playerId} className="score-item">
                            <div className="player-name">{this.getPlayerName(playerId)}</div>
                            <div className="player-score">{score}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    public render() {
        const { 
            round, 
            currentGuesser, 
            isGuesser, 
            isHost, 
            secretWord,
            isDrawingPhase, 
            isGuessingPhase, 
            isReviewPhase 
        } = this.props;

        return (
            <div className="catch-sketch">
                <div className="game-header">
                    <h2>Catch Sketch</h2>
                    <div className="round-info">Round {round + 1}</div>
                    {isGuesser && <div className="guesser-info"><h3>You are the Guesser!</h3></div>}
                    {secretWord && (
                        <div className="secret-word">Secret Word: {secretWord}</div>
                    )}
                </div>

                {isDrawingPhase && (
                    <div className="drawing-phase">
                        {this.renderTokens()}
                        {this.renderDrawingArea()}
                    </div>
                )}

                {isGuessingPhase && (
                    <div className="guessing-phase">
                        {this.renderTurnOrder()}
                        {this.renderCurrentDrawing()}
                        {this.renderGuessInput()}
                        {this.renderPreviousGuesses()}
                    </div>
                )}

                {isReviewPhase && (
                    <div className="review-phase">
                        {this.renderAllDrawings()}
                        <div className="all-guesses">
                            <h3>All Guesses</h3>
                            <div className="guesses-list">
                                {this.renderPreviousGuesses()}
                            </div>
                        </div>
                        {isHost && (
                            <div className="next-round">
                                <button onClick={this.nextRound}>Next Round</button>
                            </div>
                        )}
                    </div>
                )}

                {this.renderScores()}
            </div>
        );
    }
}