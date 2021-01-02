import * as React from 'react';

import {
    MPType,
    ViewPropsInterface
} from '../../../common/interfaces';

import { DecryptoViewPropsInterface, ValidateGuess } from '../DecryptoCommon';
import { DecryptoGameRule } from './DecryptoRules';
import { WordListView } from './DecryptoInputClues';

function ClueInput(props: DecryptoViewPropsInterface, team: number, allowGuess: boolean) {
    const clientId = props.MP.clientId;

    return props.clues[team].map((word, ind) => {
        const inputField = allowGuess ? <input style={{float:'right'}} type="number" min="1" max="4" id={clientId + '-cluereaction-' + team + '-' + ind} /> : null;
        return (<div style={{lineHeight:'25px'}}>
            { inputField }
            &nbsp;&nbsp;
            { word }
        </div>);
    });

}

function ClueReactionGuess(props: DecryptoViewPropsInterface) {
    function submitGuess()
    {
        const clientId = props.MP.clientId;
        const guesses = [null, null];
        for (let team = 0; team < 2; ++team) {
            if (props.round === 0 && props.team !== team) continue;

            const guess = [];
            for (let ind = 0; ind < 3; ++ind) {
                guess.push(parseInt((document.getElementById(clientId + '-cluereaction-' + team + '-' + ind) as any).value, 10));
            }
            guesses[team] = guess;
        }

        if (!ValidateGuess(guesses[props.team])) {
            alert("Invalid guess input");
            return;
        }

        if (props.round !== 0 && !ValidateGuess(guesses[1 - props.team])) {
            alert("Invalid guess input");
            return;
        }

        if (confirm("Submit guesses?")) {
            props.MP.submitGuess(guesses);
        }
    }

    if (!props.guessing) {
        return [
            <div style={{height: '1em'}} />,
            <h4>Finished submitting clues, go help your team guess the opponents clues!</h4>,
            OpponentClues(props)
        ];
    }

    if (props.guesses[props.team] !== null) {
        return [
            <div style={{height: '1em'}} />,
            <h4>Finished guessing, waiting for other team to guess..</h4>
        ];
    }


    const guessing = props.guessing && props.guesses[props.team] === null;
    const submitCluesBtn = (<button style={{float:'right'}} onClick={ submitGuess } >Submit Guess</button>);
    return [
        <div style={{height: '1em'}} />,
        <h4>Make guess for your own words and opponents words.</h4>,
        <div style={{height: '1em'}} />,
        <h3>Your team&apos;s clues:</h3>,
        ClueInput(props, props.team, true),
        OpponentClues(props),
        submitCluesBtn
    ];
}

function OpponentClues(props: DecryptoViewPropsInterface) {
    const allowGuess = (props.round !== 0 && props.guessing);
    return (<div className="decrypto-opponent-clues">
        <h3>Opponent team&apos;s clues:</h3>
        { ClueInput(props, 1 - props.team, allowGuess) }
        <div style={{height: '1em'}} />
    </div>);
}

export function DecryptoClientClueReaction(props: DecryptoViewPropsInterface) {
    return [
        WordListView(props),
        ClueReactionGuess(props)
    ];
}
