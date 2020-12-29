import * as React from 'react';

import {
    MPType,
    ViewPropsInterface
} from '../../../common/interfaces';

import { DecryptoViewPropsInterface, ValidateGuess } from '../DecryptoCommon';
import { DecryptoGameRule } from './DecryptoRules';
import { WordListView } from './DecryptoInputClues';

function ClueInput(props: DecryptoViewPropsInterface, team: number) {
    const clientId = props.MP.clientId;

    if (props.guesses[props.team] === null) {
        return props.clues[team].map((word, ind) => {
            const inputField = props.guessing ? <input type="number" min="1" max="4" id={clientId + '-cluereaction-' + team + '-' + ind} /> : null;
            return (<div>
                { word }
                &nbsp;&nbsp;
                { inputField }
            </div>);
        });
    } else {
        return props.clues[team].map((word, ind) => {
            return (<div>
                { word }
                &nbsp;-&nbsp;
                Guess: { props.guesses[props.team][team][ind] }
            </div>);
        });
    }
}

function ClueReactionGuess(props: DecryptoViewPropsInterface) {
    function submitGuess()
    {
        const clientId = props.MP.clientId;
        const guesses = [];
        for (let team = 0; team < 2; ++team) {
            const guess = [];
            for (let ind = 0; ind < 3; ++ind) {
                guess.push(parseInt((document.getElementById(clientId + '-cluereaction-' + team + '-' + ind) as any).value, 10));
            }
            guesses.push(guess);
        }
        if (!ValidateGuess(guesses[0]) || !ValidateGuess(guesses[1])) {
            alert("Invalid guess input");
            return;
        }
        if (confirm("Submit guesses?")) {
            props.MP.submitGuess(guesses);
        }
    }

    const guessing = props.guessing && props.guesses[props.team] === null;
    const submitCluesBtn = (<button onClick={ submitGuess } >Submit Guess</button>);
    return [
        <h1>Your team&apos;s clues:</h1>,
        ClueInput(props, props.team),
        <h1>Opponent team&apos;s clues:</h1>,
        ClueInput(props, 1 - props.team),
        guessing ? submitCluesBtn : null
    ];
}

export function DecryptoClientClueReaction(props: DecryptoViewPropsInterface) {
    return [
        WordListView(props),
        ClueReactionGuess(props)
    ];
}
