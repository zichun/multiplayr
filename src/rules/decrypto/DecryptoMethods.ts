import {
    MPType
} from '../../common/interfaces';

import { shuffle } from '../../common/utils';
import { WordList } from './wordlist';
import { TeamColors, NewRound, DecryptoGameState, ValidateGuess, EvaluateGuesses } from './DecryptoCommon';

const MAX_TEAM = 2;             // The current ruleset only supports 2 teams of 2. This can be
const PLAYERS_PER_TEAM = 2; // extended in the future.

export const DecryptoStartGame = (mp: MPType) => {
    if (mp.playersCount() !== MAX_TEAM * PLAYERS_PER_TEAM) {
        alert('We need exactly 4 players to play this game');
        return;
    }

    const accent = mp.getPlayersData('lobby_accent');
    const accent_cnt = {};
    const teams = [];

    for (let i = 0; i < MAX_TEAM; ++i) {
        teams.push([]);
    }

    mp.playersForEach((client_id, i) => {
        if (accent_cnt.hasOwnProperty(accent[i])) {
            accent_cnt[accent[i]] += 1;
        } else {
            accent_cnt[accent[i]] = 1;
        }
        const team = TeamColors.indexOf(accent[i]);
        if (team < 0 || team >= MAX_TEAM) {
            throw('Invalid Team colors!');
        }
        teams[team].push(client_id);
        mp.setPlayerData(client_id, 'team', team);
    });

    for (const a of Object.keys(accent_cnt)) {
        if (accent_cnt[a] !== 2) {
            alert('Each team needs to contain exactly 2 players');
            return;
        }
    }

    mp.setData('teams', teams);

    mp.newGame();
    mp.setData('lobby_started', true);
};

export const DecryptoNewGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw (new Error('Only host can start a new game'));
    }

    const teams = mp.getData('teams');
    const wl = WordList.slice(0);
    shuffle(wl);

    const words = [];
    const interception = [];
    const miscommunication = [];
    const notifications = [];
    for (let i = 0; i < teams.length; ++i) {
        words.push(wl.splice(0, 4));
        interception.push(0);
        miscommunication.push(0);
        notifications.push([]);
    }
    mp.setData('miscommunication', miscommunication);
    mp.setData('interception', interception);
    mp.setData('notifications', notifications);
    mp.setData('history', []);

    //
    // Push down wordlist to each player
    //
    for (let i = 0; i < teams.length; ++i) {
        for (let j = 0; j < teams[i].length; ++j) {
            mp.setPlayerData(teams[i][j], 'words', words[i]);
        }
    }

    mp.setData('words', words);
    mp.setData('round', -1);
    mp.setData('history', []);
    mp.setData('clueTurn', Math.floor(Math.random() * 2));

    NewRound(mp);
};

export const DecryptoSubmitClue = (mp: MPType, clientId: string, clues: string[]) => {
    if (clientId === mp.hostId) {
        throw (new Error('Host cannot submit a clue'));
    }

    const state = mp.getData('gameState');
    const clueSet = mp.getData('clueSet');
    const team = mp.getPlayerData(clientId, 'team');

    if (state !== DecryptoGameState.InputClues) {
        throw(new Error('State is not in input clues'));
    } else if (clueSet[team].length !== clues.length) {
        throw(new Error('Length of submitted clue is incorrect'));
    }

    const existing_clues = mp.getData('clues');
    if (existing_clues[team].length !== 0) {
        throw(new Error('Team has already submitted their clue'));
    }

    existing_clues[team] = clues;
    mp.setData('clues', existing_clues);

    const notifications = mp.getData('notifications');
    notifications[team] = [];
    mp.setData('notifications', notifications);

    let still_waiting = false;
    for (let i = 0; i < existing_clues.length; ++i) {
        if (existing_clues[i].length === 0) {
            still_waiting = true;
        }
    }

    if (!still_waiting) {
        mp.setData('gameState', DecryptoGameState.ClueReaction);
    }
};

export const DecryptoSubmitGuess = (mp: MPType, clientId: string, guess: number[][]) => {
    if (clientId === mp.hostId) {
        throw (new Error('Host cannot submit a clue'));
    }

    const state = mp.getData('gameState');
    const global_guesses = mp.getData('guesses');
    const team = mp.getPlayerData(clientId, 'team');
    const round = mp.getData('round');

    if (state !== DecryptoGameState.ClueReaction) {
        throw(new Error('State is not in clue reaction'));
    } else if (guess.length !== 2) {
        throw(new Error('Length of submitted guesses is incorrect'));
    } else if (global_guesses[team] !== null) {
        throw(new Error('Guesses for team has already been submitted'));
    } else if (!ValidateGuess(guess[team])) {
        throw(new Error('Guesses are of incorrect format'));
    } else if (round > 0 && !ValidateGuess(guess[1 - team])) {
        throw(new Error('Guesses for opponent of incorrect format'));
    }

    global_guesses[team] = guess;
    mp.setData('guesses', global_guesses);

    let still_waiting = false;
    for (let i = 0; i < global_guesses.length; ++i) {
        if (global_guesses[i] === null) {
            still_waiting = true;
        }
    }

    if (!still_waiting) {
        EvaluateGuesses(mp);
    }
};
