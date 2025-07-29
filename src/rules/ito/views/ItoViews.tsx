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
                        'view': mp.getPluginView('lobby', 'Lobby')
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
}

function MainPage(props: ItoMainViewProps) {
    switch (props.gameStatus) {
        case GameStatus.Lobby: {
            console.error("Invalid state");
            break;
        }
        case GameStatus.Scoring:
        case GameStatus.InputClues: {
            return React.createElement(ItoEnterClue, props);
            break;
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

class ItoEnterClue extends React.Component<ItoMainViewProps, { clue: string }> {
    constructor(props: ItoMainViewProps) {
        super(props);
        this.state = { clue: this.props.clue };
        this.onChange = this.onChange.bind(this);
    }

    public onChange(e: any) {
        this.setState({ clue: e.target.value });
        this.props.MP.submitClue(e.target.value);
        return true;
    }

    public render() {
        return (
            <input className='ito-enterclue'
                   defaultValue={ this.state.clue }
                   onChange={ this.onChange }
            />
        );
    }
}

export class ItoMainPage extends React.Component<ItoMainViewProps, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'language',
                        'label': 'Ito',
                        'view': MainPage(this.props)
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': ItoGameRules
                    }
                },
                'gameName': 'Round ' + (this.props.round + 1) + '/3',
                'topBarContent': '❤️' + (this.props.lives)
        });
    }
}
