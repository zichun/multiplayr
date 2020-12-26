/**
 * DecryptoViews.tsx - Collection of views for Decrypto
 */

import * as React from 'react';

import {
    MPType,
    ViewPropsInterface
} from '../../../common/interfaces';

import { DecryptoViewPropsInterface, DecryptoGameState } from '../DecryptoCommon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileSignature, faLanguage, faBook, faPlusCircle, faQuestionCircle, faPhoneSlash, faSatelliteDish } from '@fortawesome/free-solid-svg-icons';

import { DecryptoGameRule } from './DecryptoRules';
import { DecryptoClientInputClues } from './DecryptoInputClues';
import { DecryptoClientClueReaction } from './DecryptoClueReaction';


function HostMainPage(props: DecryptoViewPropsInterface) {
    function newGame() {
        return props.MP.newGame();
    }
    let history = [<div>Waiting for first move</div>];
    if (props.history.length > 0) {
        history = [
            HistoryPage(props, 0, null),
            HistoryPage(props, 1, null)
        ];
    }
    return (<div>
        { history }
        <div className="clearer">&nbsp;</div>
        <button onClick={ newGame }>New Game</button>
    </div>);
}
export class DecryptoHostMainPage extends React.Component<DecryptoViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': faLanguage,
                        'label': 'History',
                        'view': HostMainPage(this.props)
                    },
                    'rules': {
                        'icon': faBook,
                        'label': 'Rules',
                        'view': DecryptoGameRule
                    }
                }
        });
    }
}

function ClientShowScore(props: DecryptoViewPropsInterface) {
    const team = props.team;
    const miscommunication = props.miscommunication[team];
    const interception = props.interception[team];

    const gen_class = (baseName: string, team: number) => {
        return "decrypto-score-" + baseName + " bg-team-" + team;
    };
    return(
        <div id="decrypto-score">
            <div className="decrypto-score-inner">
                <div className={ gen_class('miscommunication', team) }><FontAwesomeIcon icon={ faPhoneSlash } />{ miscommunication }</div>
                <div className={ gen_class('round', team) }>{ props.round + 1 }</div>
                <div className={ gen_class('interception', team) }>{ interception }<FontAwesomeIcon icon={ faSatelliteDish } /></div>
            </div>
        </div>
);
}

function ClientMainPage(props: DecryptoViewPropsInterface) {
    const render = [];

    render.push(ClientShowScore(props));

    switch (props.gameState) {
        case DecryptoGameState.InputClues: {
            render.push(DecryptoClientInputClues(props));
            break;
        }
        case DecryptoGameState.ClueReaction: {
            render.push(DecryptoClientClueReaction(props));
            break;
        }
        case DecryptoGameState.GameOver: {
            render.push(<div>Game over</div>);
            break;
        }
    }

    return render;
}

function HistoryPage(props: DecryptoViewPropsInterface, team: number, words: string[]) {
    if (props.history.length === 0)
    {
        return (<div>No history available</div>);
    }

    const word_history = [];
    for (let i = 0; i < 4; ++i) {
        word_history.push([]);
    }

    const history = props.history;
    for (let i = 0; i < history.length; ++i) {
        const entry = history[i][team];
        for (let j = 0; j < 4; ++j)
        {
            word_history[j].push(null);
        }
        for (let j = 0; j < entry.clueSet.length; ++j)
        {
            let c = entry.clueSet[j] - 1;
            word_history[c][i] = entry.clues[j];
        }
    }

    const gen_class = (team: number) => { return 'decrypto-history-word-header bg-team-' + team; }
    const words_div = [];
    for (let i = 0; i < 4; ++i) {
        const clues = [];
        for (let j = 0; j < word_history[i].length; ++j) {
            clues.push(<div className="decrypto-history-word-clue">{ word_history[i][j] }</div>);
        }
        words_div.push(<div className="decrypto-history-word">
            <div className={ gen_class(team) }>{ words ? words[i] : '???'}</div>
            { clues }
        </div>);
    }
    return (<div className="decrypto-history">
        { words_div }
        <div className="clearer">&nbsp;</div>
    </div>);
}

export class DecyptoClientMainPage extends React.Component<DecryptoViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': faFileSignature,
                        'label': 'Decrypto',
                        'view': ClientMainPage(this.props)
                    },
                    'ownhistory': {
                        'icon': faPlusCircle,
                        'label': 'Team History',
                        'view': HistoryPage(this.props, this.props.team, this.props.words)
                    },
                    'theirhistory': {
                        'icon': faQuestionCircle,
                        'label': 'Opponent History',
                        'view': HistoryPage(this.props, 1-this.props.team, null)
                    },
                    'rules': {
                        'icon': faBook,
                        'label': 'Rules',
                        'view': DecryptoGameRule
                    }
                }
        });
    }
}

export { DecryptoGameRule };
export { DecryptoHostLobby, DecryptoClientLobby } from './DecryptoLobby';
