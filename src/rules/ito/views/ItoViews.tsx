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
    sortOrder: string[];
    sortLocked: boolean;
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
            case ItoGameState.Sorting:
                return this.renderSortingState();
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
                <p>Players are entering their clues...</p>
                <div className="ito-progress">
                    {Object.keys(this.props.cluesLocked).map(clientId => {
                        const playerIndex = this.props.clientIds.indexOf(clientId);
                        const name = this.props.names[playerIndex];
                        const locked = this.props.cluesLocked[clientId];
                        return (
                            <div key={clientId} className={`ito-player-status ${locked ? 'locked' : 'waiting'}`}>
                                {name}: {locked ? '✓ Locked' : 'Thinking...'}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    
    private renderSortingState() {
        return (
            <div className="ito-sorting">
                <h2>Sorting Phase</h2>
                <p>Players are arranging clues from lowest to highest...</p>
                <div className="ito-clues-display">
                    {this.props.sortOrder.map((clientId, index) => {
                        const playerIndex = this.props.clientIds.indexOf(clientId);
                        const name = this.props.names[playerIndex];
                        const clue = this.props.clues[clientId];
                        return (
                            <div key={clientId} className="ito-clue-item">
                                <strong>{name}:</strong> {clue}
                            </div>
                        );
                    })}
                </div>
                {this.props.sortLocked && <div className="ito-sort-locked">✓ Sort Locked In</div>}
            </div>
        );
    }
    
    private renderScoringState() {
        const correctOrder = [...this.props.sortOrder].sort((a, b) => 
            this.props.playerNumbers![a] - this.props.playerNumbers![b]
        );
        
        let errors = 0;
        for (let i = 0; i < this.props.sortOrder.length - 1; i++) {
            const currentNum = this.props.playerNumbers![this.props.sortOrder[i]];
            const nextNum = this.props.playerNumbers![this.props.sortOrder[i + 1]];
            if (currentNum > nextNum) errors++;
        }
        
        return (
            <div className="ito-scoring">
                <h2>Scoring</h2>
                <div className="ito-results">
                    <h3>Your Order:</h3>
                    {this.props.sortOrder.map((clientId, index) => {
                        const playerIndex = this.props.clientIds.indexOf(clientId);
                        const name = this.props.names[playerIndex];
                        const clue = this.props.clues[clientId];
                        const number = this.props.playerNumbers![clientId];
                        return (
                            <div key={clientId} className="ito-result-item">
                                <strong>{name}:</strong> "{clue}" (was {number})
                            </div>
                        );
                    })}
                    
                    <div className="ito-score-summary">
                        <p>Errors: {errors}</p>
                        <p>Lives Lost: {errors}</p>
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
    draggedIndex: number | null;
}> {
    constructor(props: ItoMainViewProps) {
        super(props);
        this.state = {
            currentClue: this.props.clue || '',
            draggedIndex: null
        };
        
        this.handleClueChange = this.handleClueChange.bind(this);
        this.handleLockClue = this.handleLockClue.bind(this);
        this.handleLockSort = this.handleLockSort.bind(this);
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
    
    private handleLockSort() {
        this.props.MP.lockSort();
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
            case ItoGameState.Sorting:
                return this.renderSortingState();
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
                <div className="ito-secret-number">
                    <strong>Your Secret Number: {this.props.secretNumber}</strong>
                </div>
                
                <div className="ito-clue-input">
                    <label>Enter your clue:</label>
                    <input
                        type="text"
                        value={this.state.currentClue}
                        onChange={this.handleClueChange}
                        disabled={this.props.hasLockedClue}
                        placeholder="e.g., for animal sizes: 'mouse' or 'elephant'"
                    />
                    {!this.props.hasLockedClue && (
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
                
                <div className="ito-other-clues">
                    <h3>Other Players' Clues:</h3>
                    {Object.keys(this.props.clues).map(clientId => {
                        if (clientId === this.props.MP.clientId) return null;
                        
                        const playerIndex = this.props.clientIds.indexOf(clientId);
                        const name = this.props.names[playerIndex];
                        const clue = this.props.clues[clientId];
                        const locked = this.props.cluesLocked[clientId];
                        
                        return (
                            <div key={clientId} className="ito-other-clue">
                                <strong>{name}:</strong> {locked ? clue : '...'}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    
    private renderSortingState() {
        return (
            <div className="ito-sorting">
                <h2>Sorting Phase</h2>
                <p>Drag and drop to arrange clues from lowest to highest:</p>
                
                <div className="ito-sortable-list">
                    {this.props.sortOrder.map((clientId, index) => {
                        const playerIndex = this.props.clientIds.indexOf(clientId);
                        const name = this.props.names[playerIndex];
                        const clue = this.props.clues[clientId];
                        
                        return (
                            <div
                                key={clientId}
                                className="ito-sortable-item"
                                draggable={!this.props.sortLocked}
                                onDragStart={() => this.setState({ draggedIndex: index })}
                                onDragOver={this.handleDragOver}
                                onDrop={(e) => this.handleDrop(e, index)}
                            >
                                <span className="ito-drag-handle">≡</span>
                                <strong>{name}:</strong> {clue}
                            </div>
                        );
                    })}
                </div>
                
                {!this.props.sortLocked && this.props.sortOrder.length > 0 && (
                    <button onClick={this.handleLockSort} className="ito-lock-sort">
                        Lock In This Order
                    </button>
                )}
                
                {this.props.sortLocked && (
                    <div className="ito-sort-locked">✓ Order Locked In</div>
                )}
            </div>
        );
    }
    
    private handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };
    
    private handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        
        if (this.state.draggedIndex === null || this.props.sortLocked) return;
        
        const newOrder = [...this.props.sortOrder];
        const draggedItem = newOrder[this.state.draggedIndex];
        
        newOrder.splice(this.state.draggedIndex, 1);
        newOrder.splice(dropIndex, 0, draggedItem);
        
        this.props.MP.updateSort(newOrder);
        this.setState({ draggedIndex: null });
    };
    
    private renderScoringState() {
        // Same as host view but for client
        return (
            <div className="ito-scoring">
                <h2>Scoring</h2>
                <p>Waiting for next round or game end...</p>
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