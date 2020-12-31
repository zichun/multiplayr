/**
 * DecryptoViews.tsx - Collection of views for Decrypto
 */

import * as React from 'react';

import {
    MPType,
    ViewPropsInterface
} from '../../../common/interfaces';

import {
    DecryptoViewPropsInterface,
    DecryptoGameState,
    DecryptoSingleRoundInfoInterface,
    DecryptoGuessesInterface,
    DecryptoScoreInterface
} from '../DecryptoCommon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { DecryptoGameRule } from './DecryptoRules';
import { DecryptoClientInputClues } from './DecryptoInputClues';
import { DecryptoClientClueReaction } from './DecryptoClueReaction';

function SingleRoundView(roundInfo: DecryptoSingleRoundInfoInterface) {
    return (
        <div className='single-round'>
            <div className='round-title'>
                <div className='round-header'>
                    <span className='round-header-icon'>T</span>
                    <span className='round-header-icon'>U</span>
                    <span className='round-header-icon'>A</span>
                </div>
                <div className='round-number'># {roundInfo.roundNumber}</div>
            </div>
            {roundInfo.info.map((info, idx) => (
                <div className={idx % 2 ? 'single-row second' : 'single-row'}>
                    <span style={{
                        display:'inline-block',
                        overflow:'hidden',
                        width:'140px',
                        whiteSpace: 'nowrap',
                        textOverflow:'ellipsis'
                    }}>
                        {info.phrase}
                    </span>
                    <input type="number" value={info.actual === 0 ? undefined : info.actual}/>
                    <input type="number" value={info.ownGuess === 0 ? undefined : info.ownGuess}/>
                    <input type="number" value={info.otherGuess === 0 ? undefined : info.otherGuess}/>
                </div>
            ))}
        </div>
    );
}

function GuessesView(guesses: DecryptoGuessesInterface) {
    return (
        <div style={{
            float: 'left',
            border: '1px solid grey',
        }}>
            {[1,2,3,4].map(number => (
                <div style={{
                    width: '125px',
                    height: '400px',
                    backgroundColor: number % 2 ? 'white' : 'lightgrey',
                    float: 'left',
                    textAlign: 'center',
                }}>
                    {number}
                    {guesses[number-1].map(guess => (<div>{guess}</div>))}
                </div>
            ))}
        </div>
    );
}

function ParseData(props: DecryptoViewPropsInterface) {
    const guesses = [[[],[],[],[]], [[],[],[],[]]];
    const roundData = [[1,2,3,4,5,6,7,8].map(roundNumber => ({
        roundNumber,
        info: [1,2,3].map(number => ({
            phrase: '',
            actual: 0,
            otherGuess: 0,
            ownGuess: 0,
        })),
    }))];
    roundData.push(JSON.parse(JSON.stringify(roundData[0])));
    const roundInfos = props.history;
    for (let i = 0; i < roundInfos.length; ++i) {
        const roundInfo = roundInfos[i];
        for (let j = 0; j < 3; ++j) {
            for (let k = 0; k < 2; ++k) {
                guesses[k][roundInfo[k].clueSet[j] - 1].push(roundInfo[k].clues[j]);
                roundData[k][i].info[j].phrase = roundInfo[k].clues[j]
                roundData[k][i].info[j].actual = roundInfo[k].clueSet[j]
                roundData[k][i].info[j].ownGuess = roundInfo[k].ownGuess[j]
                roundData[k][i].info[j].otherGuess = roundInfo[k].otherGuess[j]
            }
        }
    }
    const scoreInfo = Array(2).fill({
        miscommunication: props.miscommunication,
        interception: props.interception,
        round: props.round,
    });
    return {
        scoreInfo,
        guesses,
        roundData,
    };
}

function PaperView(
    scoreData: DecryptoScoreInterface[],
    roundData: DecryptoSingleRoundInfoInterface[][],
    guesses: DecryptoGuessesInterface[],
) {
    return (
        <div>
            {[0, 1].map(player => {
                return (<div style={{width: '552px', float:'left'}}>
                    <div style={{float: 'left', width: '50px', height: '850px'}} />
                    <div style={{width: '500px', float:'left'}}>
                        {ClientShowScore({team: player, ...scoreData[player]})}
                    </div>
                    <div style={{float:'left'}}>
                        {[0,1,2,3].map((number) => SingleRoundView(roundData[player][number]))}
                    </div>
                    <div style={{float:'left'}}>
                        {[4,5,6,7].map((number) => SingleRoundView(roundData[player][number]))}
                    </div>
                    {GuessesView(guesses[player])}
                </div>);
            })}
        </div>
    );
}

function HostMainPage(props: DecryptoViewPropsInterface) {
    function newGame() {
        return props.MP.newGame();
    }
    const data = ParseData(props);

    return (<div>
        <button className='new-game-btn' onClick={ newGame }>New Game</button>
        <div>{PaperView(data.scoreInfo, data.roundData, data.guesses)}</div>
        <div className="clearer">&nbsp;</div>
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
                        'icon': 'language',
                        'label': 'History',
                        'view': HostMainPage(this.props)
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': DecryptoGameRule
                    }
                },
                'gameName': 'Decrypto',
        });
    }
}

function ClientShowScore(props: DecryptoScoreInterface) {
    const team = props.team;
    const miscommunication = props.miscommunication[team];
    const interception = props.interception[team];

    const gen_class = (baseName: string, team: number) => {
        return "decrypto-score-" + baseName + " bg-team-" + team;
    };
    return(
        <div id="decrypto-score">
            <div className="decrypto-score-inner">
                <div className={ gen_class('miscommunication', team) }><FontAwesomeIcon icon="phone-slash" />{ miscommunication }</div>
                <div className={ gen_class('round', team) }>{ props.round + 1 }</div>
                <div className={ gen_class('interception', team) }>{ interception }<FontAwesomeIcon icon="satellite-dish" /></div>
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
            const c = entry.clueSet[j] - 1;
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
                        'icon': 'file-signature',
                        'label': 'Decrypto',
                        'view': ClientMainPage(this.props)
                    },
                    'ownhistory': {
                        'icon': 'plus-circle',
                        'label': 'Team History',
                        'view': HistoryPage(this.props, this.props.team, this.props.words)
                    },
                    'theirhistory': {
                        'icon': 'question-circle',
                        'label': 'Opponent History',
                        'view': HistoryPage(this.props, 1-this.props.team, null)
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': DecryptoGameRule
                    }
                },
                'gameName': 'Decrypto',
        });
    }
}

export { DecryptoGameRule };
export { DecryptoHostLobby, DecryptoClientLobby } from './DecryptoLobby';
