/**
 * ItoViews.tsx - React components for Ito game
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { ItoGameState } from '../ItoTypes';

// Lobby Views
export class ItoHostLobby extends React.Component<ViewPropsInterface, {}> {
    constructor(props: ViewPropsInterface) {
        super(props);
        this.startGame = this.startGame.bind(this);
    }

    public startGame() {
        this.props.MP.startGame();
    }

    public render() {
        const lobbyView = this.props.MP.parent.getPluginView('lobby', 'Lobby');
        const roomManagement = this.props.MP.parent.getPluginView('lobby', 'host-roommanagement');
        
        return (
            <div className="ito-lobby">
                <h1>Ito - Cooperative Number Game</h1>
                <div className="ito-rules">
                    <p>Work together to sort your clues from lowest to highest numbers!</p>
                    <p>You have 3 rounds and lives equal to the number of players.</p>
                    <p>Lose a life for each incorrectly ordered pair.</p>
                </div>
                {React.createElement(lobbyView, this.props)}
                {React.createElement(roomManagement, this.props)}
            </div>
        );
    }
}

export class ItoClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const setNameView = this.props.MP.parent.getPluginView('lobby', 'SetName');
        
        return (
            <div className="ito-lobby">
                <h1>Ito - Cooperative Number Game</h1>
                <div className="ito-rules">
                    <p>Work together to sort your clues from lowest to highest numbers!</p>
                    <p>You have 3 rounds and lives equal to the number of players.</p>
                    <p>Lose a life for each incorrectly ordered pair.</p>
                </div>
                {React.createElement(setNameView, this.props)}
                <div className="ito-waiting">Waiting for game to start...</div>
            </div>
        );
    }
}

// Main Game Views
interface ItoMainViewProps extends ViewPropsInterface {
    gameState: ItoGameState;
    round: number;
    lives: number;
    category: string;
    secretNumber?: number;
    clue?: string;
    hasLockedClue?: boolean;
    clues: { [clientId: string]: string };
    cluesLocked: { [clientId: string]: boolean };
    currentTurnPlayer?: string;
    lockedPlayers: string[];
    livesLostThisRound: number;
    names: string[];
    clientIds: string[];
    playerNumbers?: { [clientId: string]: number };
}

export class ItoHostMainPage extends React.Component<ItoMainViewProps, {}> {
    public render() {
        return (
            <div className="ito-host">
                <div className="ito-header">
                    <h1>Ito - Round {this.props.round + 1}/3</h1>
                    <div className="ito-lives">Lives: {this.props.lives}</div>
                </div>
                
                <div className="ito-game-content">
                    {this.renderGameStateContent()}
                </div>
            </div>
        );
    }
    
    private renderGameStateContent() {
        switch (this.props.gameState) {
            case ItoGameState.InputClues:
                return this.renderInputCluesState();
            case ItoGameState.Scoring:
                return this.renderScoringState();
            case ItoGameState.Victory:
                return this.renderVictoryState();
            case ItoGameState.Defeat:
                return this.renderDefeatState();
            default:
                return <div>Unknown game state</div>;
        }
    }
    
    private renderInputCluesState() {
        return (
            <div className="ito-input-clues">
                <h2>Category: {this.props.category}</h2>
                <p>Players lock in their clues one by one...</p>
                {this.props.currentTurnPlayer && (
                    <div className="ito-current-turn">
                        <strong>Current Turn: {this.props.names[this.props.clientIds.indexOf(this.props.currentTurnPlayer)]}</strong>
                    </div>
                )}
                <div className="ito-progress">
                    {this.props.lockedPlayers.map((clientId, index) => {
                        const playerIndex = this.props.clientIds.indexOf(clientId);
                        const name = this.props.names[playerIndex];
                        const clue = this.props.clues[clientId];
                        const number = this.props.playerNumbers![clientId];
                        return (
                            <div key={clientId} className="ito-locked-player">
                                <strong>#{index + 1} {name}:</strong> &quot;{clue}&quot; (was {number})
                            </div>
                        );
                    })}
                </div>
                <div className="ito-waiting-players">
                    {Object.keys(this.props.cluesLocked).map(clientId => {
                        if (this.props.cluesLocked[clientId]) return null;
                        const playerIndex = this.props.clientIds.indexOf(clientId);
                        const name = this.props.names[playerIndex];
                        const isCurrentTurn = clientId === this.props.currentTurnPlayer;
                        return (
                            <div key={clientId} className={`ito-player-status ${isCurrentTurn ? 'current-turn' : 'waiting'}`}>
                                {name}: {isCurrentTurn ? 'Thinking...' : 'Waiting for turn'}
                            </div>
                        );
                    })}
                </div>
                {this.props.livesLostThisRound > 0 && (
                    <div className="ito-lives-lost">
                        <strong>Lives lost this round: {this.props.livesLostThisRound}</strong>
                    </div>
                )}
            </div>
        );
    }
    
    
    private renderScoringState() {
        return (
            <div className="ito-scoring">
                <h2>Scoring</h2>
                <div className="ito-results">
                    <h3>Final Order:</h3>
                    {this.props.lockedPlayers.map((clientId, index) => {
                        const playerIndex = this.props.clientIds.indexOf(clientId);
                        const name = this.props.names[playerIndex];
                        const clue = this.props.clues[clientId];
                        const number = this.props.playerNumbers![clientId];
                        return (
                            <div key={clientId} className="ito-result-item">
                                <strong>#{index + 1} {name}:</strong> &quot;{clue}&quot; (was {number})
                            </div>
                        );
                    })}
                    
                    <div className="ito-score-summary">
                        <p>Lives Lost This Round: {this.props.livesLostThisRound}</p>
                        <p>Lives Remaining: {this.props.lives}</p>
                    </div>
                </div>
            </div>
        );
    }
    
    private renderVictoryState() {
        return (
            <div className="ito-victory">
                <h2>🎉 Victory! 🎉</h2>
                <p>You completed all 3 rounds with {this.props.lives} lives remaining!</p>
                <p>Excellent teamwork!</p>
                <button onClick={() => this.props.MP.restartGame()}>Play Again</button>
            </div>
        );
    }
    
    private renderDefeatState() {
        return (
            <div className="ito-defeat">
                <h2>💔 Game Over 💔</h2>
                <p>You ran out of lives on round {this.props.round + 1}.</p>
                <p>Better luck next time!</p>
                <button onClick={() => this.props.MP.restartGame()}>Play Again</button>
            </div>
        );
    }
}

export class ItoClientMainPage extends React.Component<ItoMainViewProps, { 
    currentClue: string;
}> {
    constructor(props: ItoMainViewProps) {
        super(props);
        this.state = {
            currentClue: this.props.clue || ''
        };
        
        this.handleClueChange = this.handleClueChange.bind(this);
        this.handleLockClue = this.handleLockClue.bind(this);
    }
    
    componentDidUpdate(prevProps: ItoMainViewProps) {
        if (prevProps.clue !== this.props.clue) {
            this.setState({ currentClue: this.props.clue || '' });
        }
    }
    
    private handleClueChange(event: React.ChangeEvent<HTMLInputElement>) {
        const clue = event.target.value;
        this.setState({ currentClue: clue });
        this.props.MP.submitClue(clue);
    }
    
    private handleLockClue() {
        if (this.state.currentClue.trim()) {
            this.props.MP.lockClue();
        }
    }
    
    public render() {
        return (
            <div className="ito-client">
                <div className="ito-header">
                    <h1>Ito - Round {this.props.round + 1}/3</h1>
                    <div className="ito-lives">Lives: {this.props.lives}</div>
                </div>
                
                <div className="ito-game-content">
                    {this.renderGameStateContent()}
                </div>
            </div>
        );
    }
    
    private renderGameStateContent() {
        switch (this.props.gameState) {
            case ItoGameState.InputClues:
                return this.renderInputCluesState();
            case ItoGameState.Scoring:
                return this.renderScoringState();
            case ItoGameState.Victory:
                return this.renderVictoryState();
            case ItoGameState.Defeat:
                return this.renderDefeatState();
            default:
                return <div>Unknown game state</div>;
        }
    }
    
    private renderInputCluesState() {
        const isMyTurn = this.props.currentTurnPlayer === this.props.MP.clientId;
        const canEdit = !this.props.hasLockedClue && isMyTurn;
        
        return (
            <div className="ito-input-clues">
                <h2>Category: {this.props.category}</h2>
                <div className="ito-secret-number">
                    <strong>Your Secret Number: {this.props.secretNumber}</strong>
                </div>
                
                {this.props.currentTurnPlayer && (
                    <div className="ito-turn-info">
                        {isMyTurn ? (
                            <strong className="ito-my-turn">It&apos;s your turn to lock in your clue!</strong>
                        ) : (
                            <span>Waiting for {this.props.names[this.props.clientIds.indexOf(this.props.currentTurnPlayer)]} to lock their clue...</span>
                        )}
                    </div>
                )}
                
                <div className="ito-clue-input">
                    <label>Your clue:</label>
                    <input
                        type="text"
                        value={this.state.currentClue}
                        onChange={this.handleClueChange}
                        disabled={this.props.hasLockedClue || !isMyTurn}
                        placeholder="e.g., for animal sizes: 'mouse' or 'elephant'"
                    />
                    {canEdit && (
                        <button 
                            onClick={this.handleLockClue}
                            disabled={!this.state.currentClue.trim()}
                        >
                            Lock Clue
                        </button>
                    )}
                    {this.props.hasLockedClue && (
                        <div className="ito-locked">✓ Clue Locked</div>
                    )}
                </div>
                
                <div className="ito-locked-clues">
                    <h3>Locked Clues (in order):</h3>
                    {this.props.lockedPlayers.map((clientId, index) => {
                        const playerIndex = this.props.clientIds.indexOf(clientId);
                        const name = this.props.names[playerIndex];
                        const clue = this.props.clues[clientId];
                        return (
                            <div key={clientId} className="ito-locked-clue">
                                <strong>#{index + 1} {name}:</strong> &quot;{clue}&quot;
                            </div>
                        );
                    })}
                </div>
                
                {this.props.livesLostThisRound > 0 && (
                    <div className="ito-lives-lost">
                        <strong>Lives lost this round: {this.props.livesLostThisRound}</strong>
                    </div>
                )}
            </div>
        );
    }
    
    private renderScoringState() {
        return (
            <div className="ito-scoring">
                <h2>Scoring</h2>
                <p>Round complete! Checking results...</p>
                <div className="ito-results">
                    <h3>Final Order:</h3>
                    {this.props.lockedPlayers.map((clientId, index) => {
                        const playerIndex = this.props.clientIds.indexOf(clientId);
                        const name = this.props.names[playerIndex];
                        const clue = this.props.clues[clientId];
                        return (
                            <div key={clientId} className="ito-result-item">
                                <strong>#{index + 1} {name}:</strong> &quot;{clue}&quot;
                            </div>
                        );
                    })}
                    
                    <div className="ito-score-summary">
                        <p>Lives Lost This Round: {this.props.livesLostThisRound}</p>
                        <p>Lives Remaining: {this.props.lives}</p>
                    </div>
                </div>
            </div>
        );
    }
    
    private renderVictoryState() {
        return (
            <div className="ito-victory">
                <h2>🎉 Victory! 🎉</h2>
                <p>You completed all 3 rounds with {this.props.lives} lives remaining!</p>
                <p>Excellent teamwork!</p>
            </div>
        );
    }
    
    private renderDefeatState() {
        return (
            <div className="ito-defeat">
                <h2>💔 Game Over 💔</h2>
                <p>You ran out of lives on round {this.props.round + 1}.</p>
                <p>Better luck next time!</p>
            </div>
        );
    }
}