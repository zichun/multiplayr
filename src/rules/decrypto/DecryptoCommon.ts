import { MPType, ViewPropsInterface } from '../../common/interfaces';
import { shuffle } from '../../common/utils';

export const TeamColors = ['#0074D9', '#FF851B'];

export enum DecryptoGameState {
    InputClues = 1,       // Teams write clues for given triplet
    ClueReaction,         // Other players react to the clues given
    GameOver              // Game over screen.
}

export enum DecryptoNotification {
    Miscommunication,
    Interception
}

export interface DecryptoViewPropsInterface extends ViewPropsInterface {
    lobby: any;
    state: DecryptoGameState;
    words: string[];
    clueSet: number[];
    guessing: boolean;
    clues: string[][];
    guesses: number[][];
    team: number;
    gameState: DecryptoGameState;
    miscommunication: number[];
    interception: number[];
    round: number;
    history: any;
    notifications: DecryptoNotification[];
}

export interface DecryptoSingleRowInfoInterface {
    phrase: string;
    otherGuess: number;
    ownGuess: number;
    actual: number;
}

export interface DecryptoSingleRoundInfoInterface {
    roundNumber: number;
    info: DecryptoSingleRowInfoInterface[];
}

export interface DecryptoGuessesInterface {
    [index: number]: string[];
}

export interface DecryptoScoreInterface {
    team: number;
    miscommunication: number[];
    interception: number[];
    round: number;
}

function NewClueSet() {
    const words = [1, 2, 3, 4];
    shuffle(words);
    return words.splice(0, 3);
}

export const NewRound = (mp: MPType) => {
    const teams = mp.getData('teams');

    mp.setData('gameState', DecryptoGameState.InputClues);
    const clueTurn = (mp.getData('clueTurn') + 1) % 2;
    mp.setData('clueTurn', clueTurn);

    mp.setData('round', mp.getData('round') + 1);

    const clues = [];
    const guesses = [];
    for (let i = 0; i < teams.length; ++i) {
        clues.push([]);
        guesses.push(null);
    }
    mp.setData('clues', clues);
    mp.setData('guesses', guesses);

    const clueSet = [];
    for (let i = 0; i < teams.length; ++i) {
        clueSet.push(NewClueSet());
    }
    mp.setData('clueSet', clueSet);
};

export function ValidateGuess(guess: number[]) {
    if (guess.length !== 3) {
        return false;
    }
    if (guess.filter(g => {
        return typeof g !== 'number' || g < 1 || g > 4 || Number.isNaN(g);
    }).length > 0) {
        return false;
    }
    for (let i = 0; i < guess.length; ++i) {
        for (let j = i + 1; j < guess.length; ++j) {
            if (guess[i] === guess[j]) {
                return false;
            }
        }
    }
    return true;
}

export function EvaluateGuesses(mp: MPType) {
    const guesses = mp.getData('guesses');
    const clueSet = mp.getData('clueSet');
    const teams = mp.getData('teams');
    const notifications = [];

    for (let i = 0; i < teams.length; ++i) {
        notifications.push([]);
    }

    // first, evaluate guesses of own team
    const miscommunication = mp.getData('miscommunication');
    for (let i = 0; i < teams.length; ++i) {
        let miscommunicate = false;

        // compare guesses[i][i] against clueSet[i]
        if (guesses[i][i].length !== clueSet[i].length) {
            throw('Unexpected - guesses and clueSet length don\'t match');
        }
        for (let j = 0; j < guesses[i][i].length; ++j) {
            if (clueSet[i][j] !== guesses[i][i][j]) {
                miscommunicate = true;
                break;
            }
        }

        if (miscommunicate) {
            miscommunication[i] += 1;
            notifications[i].push(DecryptoNotification.Miscommunication);
        }
    }
    mp.setData('miscommunication', miscommunication);

    // evaluate interceptions
    const interception = mp.getData('interception');
    for (let i = 0; i < teams.length; ++i) {
        let intercepted = true;

        // compare guesses[i][1 - i] against clueSet[1 - i]
        // the code below assumes 2 teams. it'd need to be modified if it's generalized to
        // more than 2 teams.
        if (guesses[i][1 - i].length !== clueSet[1 - i].length) {
            throw('Unexpected - guesses and clueSet length don\'t match');
        }
        for (let j = 0; j < guesses[i].length; ++j) {
            if (guesses[i][1 - i][j] !== clueSet[1 - i][j]) {
                intercepted = false;
                break;
            }
        }

        if (intercepted) {
            interception[i] += 1;
            notifications[i].push(DecryptoNotification.Interception);
        }
    }
    mp.setData('interception', interception);

    // commit clues and guesses to history
    const clues = mp.getData('clues');
    const history_entry = [];
    for (let i = 0; i < teams.length; ++i) {
        history_entry.push({
            clues: clues[i].slice(),
            clueSet: clueSet[i].slice(),
            ownGuess: guesses[i][i].slice(),
            otherGuess: guesses[1 - i][i].slice()
        });
    }
    const history = mp.getData('history');
    history.push(history_entry);
    mp.setData('history', history);

    let gameOver = false;
    for (let i = 0; i < teams.length; ++i) {
        if (interception[i] === 2 || miscommunication[i] === 2) {
            mp.setData('gameState', DecryptoGameState.GameOver);
            gameOver = true;
        }
    }

    mp.setData('notifications', notifications);

    if (!gameOver) {
        NewRound(mp);
    }
}
