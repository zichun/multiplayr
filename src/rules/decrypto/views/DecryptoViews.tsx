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

function SingleRoundView(roundInfo: DecryptoSingleRoundInfoInterface, skipOtherGuess: boolean) {
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
                {skipOtherGuess}
                    </span>
                    <input type="number" readOnly value={info.actual === 0 ? undefined : info.actual}/>
                    <input type="number" readOnly value={info.ownGuess === 0 ? undefined : info.ownGuess}/>
                    <input type="text" readOnly value={
                    skipOtherGuess ? '-' : (info.otherGuess === 0 ? undefined : info.otherGuess)
                    }/>
                </div>
            ))}
        </div>
    );
}

function GuessesView(guesses: DecryptoGuessesInterface, words: string[]) {
    return (
        <div className="guess-view" style={{
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
                    <div className="word-header">{ words ? words[number - 1] : number}</div>
                    {guesses[number-1].map(guess => (<div className="guess">{guess}</div>))}
                </div>
            ))}
        </div>
    );
}

function HostPapersView(
    scoreData: DecryptoScoreInterface[],
    roundData: DecryptoSingleRoundInfoInterface[][],
    guesses: DecryptoGuessesInterface[],
) {
    return (
        <div>
            { PaperView(scoreData, roundData, guesses, 0, null) },
            { PaperView(scoreData, roundData, guesses, 1, null) },
        </div>
    );
}

function PaperView(
    scoreData: DecryptoScoreInterface[],
    roundData: DecryptoSingleRoundInfoInterface[][],
    guesses: DecryptoGuessesInterface[],
    team: number,
    words: string[]
) {
    return (<div style={{width: '552px', float:'left'}}>
        <div style={{float: 'left', width: '50px', height: '850px'}} />
        <div style={{width: '500px', float:'left'}}>
            {ClientShowScore({team: team, ...scoreData[team]})}
        </div>
        <div style={{float:'left'}}>
            {[0,1,2,3].map((number) => SingleRoundView(roundData[team][number], number === 0))}
        </div>
        <div style={{float:'left'}}>
            {[4,5,6,7].map((number) => SingleRoundView(roundData[team][number], false))}
        </div>
        {GuessesView(guesses[team], words)}
    </div>);
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
                roundData[k][i].info[j].otherGuess = roundInfo[k].otherGuess && roundInfo[k].otherGuess[j]
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

function HostMainPage(props: DecryptoViewPropsInterface) {
    function newGame() {
        return props.MP.newGame();
    }
    const data = ParseData(props);

    return (<div>
        <button className='new-game-btn' onClick={ newGame }>New Game</button>
        <div>{HostPapersView(data.scoreInfo, data.roundData, data.guesses)}</div>
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

function HistoryPage(data: any, team: number, words: string[]) {
    return PaperView(data.scoreInfo, data.roundData, data.guesses, team, words);
}

export class DecyptoClientMainPage extends React.Component<DecryptoViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        const data = ParseData(this.props);

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
                        'view': HistoryPage(data, this.props.team, this.props.words)
                    },
                    'theirhistory': {
                        'icon': 'question-circle',
                        'label': 'Opponent History',
                        'view': HistoryPage(data, 1-this.props.team, null)
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
