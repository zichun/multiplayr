/**
 * ItoViews.tsx - React components for Ito game
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { ItoGameRules } from './ItoRules';
import {GameStatus } from '../ItoGameState';

// Lobby Views
export class ItoHostLobby extends React.Component<ViewPropsInterface, {}> {
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
                        'view': ItoGameRules
                    }
                }
            }
        );
    }
}

export class ItoClientLobby extends React.Component<ViewPropsInterface, {}> {
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
                        'view': ItoGameRules
                    }
                }
        });
    }
}

// Main Game Views
interface ItoMainViewProps extends ViewPropsInterface {
    hasLockedClue: boolean,
    secretNumber: number,
    category: String,
    gameStatus: GameStatus,
    round: number,
    lives: number,
    lobby: any,
    clues: { [clientId: string]: string },
    clue: string,
    locked: object[],
    isHost: boolean
}

function MainPage(props: ItoMainViewProps) {
    switch (props.gameStatus) {
        case GameStatus.Scoring:
        case GameStatus.InputClues: {
            return React.createElement(ItoInputClues, props);
        }
        case GameStatus.Victory: {
            return (
                <div className="ito-victory">
                    <h2>🎉 Victory! 🎉</h2>
                    <p>You completed all 3 rounds with {this.props.lives} lives remaining!</p>
                    <p>Excellent teamwork!</p>
                </div>
            );
        }
        case GameStatus.Defeat: {
            return (
                <div className="ito-defeat">
                    <h2>💔 Game Over 💔</h2>
                    <p>You ran out of lives on round {this.props.round + 1}.</p>
                    <p>Better luck next time!</p>
                </div>
            );
        }
    }
}

class ItoInputClues extends React.Component<ItoMainViewProps, {}> {
    render() {
        const { MP, clues, locked, secretNumber, hasLockedClue, category, lives, isHost, round, gameStatus } = this.props;
        const clientId = MP.clientId;
        console.log(MP.hostId + " " + clientId);

        const lockedClientIds = new Set(locked.map((p: any) => p.clientId));
        const unlockedPlayers = Object.keys(clues)
            .filter(id => !lockedClientIds.has(id));

        let lastLockedNumber = -1;
        const roundEnded = gameStatus === GameStatus.Scoring;
        const nextRound = isHost && roundEnded && lives > 0;
        const gameEnded = roundEnded && (lives <= 0 || round >= 2)
        const newGame = isHost && gameEnded;
        const victory = gameEnded && lives > 0;
        const gameLoss = gameEnded && lives <= 0;

        return (
            <div className="ito-input-clues-container">
                {gameLoss && (
                    <div className="ito-defeat">
                        <h2>💔 Game Over 💔</h2>
                    </div>
                )}
                {victory && (
                    <div className="ito-victory">
                        <h2>🎉 Victory! 🎉</h2>
                    </div>
                )}
                <div className="ito-your-info">
                    <div className="category-display">{category}</div>
                    {typeof secretNumber !== 'undefined' && <div className="secret-number-display">{secretNumber}</div>}
                </div>

                <div className="ito-locked-players">
                    <h3>Locked In</h3>
                    {locked.length === 0 && <p style={{ textAlign: 'center' }}>Players have not locked in yet.</p>}
                    {locked.map((player: any) => {
                        const isOutOfOrder = player.secretNumber < lastLockedNumber;
                        lastLockedNumber = player.secretNumber;
                        const playerTag = MP.getPluginView('lobby', 'player-tag', { clientId: player.clientId });
                        return (
                            <div key={player.clientId} className={`player-row locked ${isOutOfOrder ? 'out-of-order' : ''}`}>
                                <div className="player-clue-number">
                                    <div className="player-tag-clue">
                                        <div className="player-tag-container">{playerTag}</div>
                                        <div className="player-clue">{player.clue}</div>
                                    </div>
                                    <div className="player-number">{player.secretNumber}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                { unlockedPlayers.length > 0 && (
                    <div className="ito-unlocked-players">
                        <h3>Players</h3>
                        {unlockedPlayers.map(id => {
                            const playerTag = MP.getPluginView('lobby', 'player-tag', { clientId: id });
                            const isCurrentUser = id === clientId;

                            return (
                                <div key={id} className={`player-row unlocked ${isCurrentUser ? 'current-user' : ''}`}>
                                    <div className="player-clue-number">
                                        <div className="player-tag-clue">
                                            <div className="player-tag-container">{playerTag}</div>
                                            <div className="player-clue">
                                                {isCurrentUser && !hasLockedClue ? (
                                                    <ItoEnterClue {...this.props} />
                                                ) : (
                                                    clues[id] || <em>Waiting for clue...</em>
                                                )}
                                            </div>
                                        </div>
                                        <div className="player-number">?</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!hasLockedClue && !roundEnded && (
                    <button className="lock-in-button" onClick={() => this.props.MP.lockClue()}>
                        Lock It In
                    </button>
                )}

                {nextRound && (
                    <button className="lock-in-button" onClick={() => this.props.MP.nextRound()}>
                        Next Round {this.props.round >= 2 ? ' (Endless)' : '' }
                    </button>
                )}

                {newGame && (
                    <button className="lock-in-button" onClick={() => this.props.MP.restartGame()}>
                        Start New Game
                    </button>
                )}
            </div>
        );
    }
}

class ItoEnterClue extends React.Component<ItoMainViewProps, { clue: string }> {
    constructor(props: ItoMainViewProps) {
        super(props);
        this.state = { clue: this.props.clue };
        this.onChange = this.onChange.bind(this);
    }

    componentDidUpdate(prevProps: ItoMainViewProps) {
        if (prevProps.clue !== this.props.clue) {
            this.setState({ clue: this.props.clue });
        }
    }

    public onChange(e: any) {
        this.setState({ clue: e.target.value });
        this.props.MP.submitClue(e.target.value);
        return true;
    }

    public render() {
        return (
            <input className='ito-enterclue'
                   value={ this.state.clue }
                   onChange={ this.onChange }
                   disabled={this.props.hasLockedClue}
                   placeholder="Enter your clue here"
            />
        );
    }
}

export class ItoMainPage extends React.Component<ItoMainViewProps, {}> {
    public render() {
        const mp = this.props.MP;

        const links = {
            'home': {
                'icon': 'gamepad',
                'label': 'Ito',
                'view': MainPage(this.props)
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': ItoGameRules
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Settings',
                'view': (
                    <div>
                        <button className="lock-in-button" onClick={() => this.props.MP.restartGame()}>
                            Restart Game
                        </button>
                        <button className="lock-in-button" onClick={() => this.props.MP.backToLobby()}>
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
                'gameName': 'Round ' + (this.props.round + 1) + '/3',
                'topBarContent': '❤️' + (this.props.lives)
        });
    }
}
