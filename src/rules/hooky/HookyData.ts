/**
 * HookyData.ts — static tables for Hooky: the 26 students (one per letter),
 * the per-player-count setup, the word list check and the answer count.
 */

import { WORDS_RAW } from './HookyWords';

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const WORD_LEN = 5;
export const HOOKY_COUNT = 3;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

/** Original student names: one per letter card. */
export const STUDENTS: Record<string, string> = {
    A: 'Abby', B: 'Bruno', C: 'Cleo', D: 'Dex', E: 'Ellie', F: 'Finn', G: 'Gigi', H: 'Hugo', I: 'Ivy',
    J: 'Jojo', K: 'Kai', L: 'Lulu', M: 'Milo', N: 'Nora', O: 'Otto', P: 'Pip', Q: 'Quinn', R: 'Rosie',
    S: 'Sami', T: 'Theo', U: 'Uma', V: 'Vic', W: 'Wren', X: 'Xavi', Y: 'Yuki', Z: 'Zed'
};

export interface Setup {
    hand: number;
    playground: number;
    rounds: number;
    /** Playground cards turned face up during setup. */
    pgAtStart: number;
    /** After these rounds one more Playground card is turned up. */
    pgAfter: number[];
    /** After these rounds everyone secretly guesses the 3 Hooky letters. The last one is the final guess. */
    guessAfter: number[];
}

/** 3–5 from the rulebook; 6 is the house variant agreed with the user (see docs/hooky-design.md). */
export const SETUPS: Record<number, Setup> = {
    3: { hand: 7, playground: 2, rounds: 6, pgAtStart: 0, pgAfter: [1, 2], guessAfter: [4, 5, 6] },
    4: { hand: 5, playground: 3, rounds: 6, pgAtStart: 0, pgAfter: [1, 2, 3], guessAfter: [4, 5, 6] },
    5: { hand: 4, playground: 3, rounds: 6, pgAtStart: 0, pgAfter: [1, 2, 3], guessAfter: [4, 5, 6] },
    6: { hand: 3, playground: 5, rounds: 5, pgAtStart: 3, pgAfter: [1, 2], guessAfter: [3, 4, 5] }
};

export const EARLY_POINTS = 5;
export const FINAL_POINTS = 10;

/** Points per correct Hooky letter for a guess made after `round`. */
export function hookyPointsFor(setup: Setup, round: number): number {
    return round === setup.guessAfter[setup.guessAfter.length - 1] ? FINAL_POINTS : EARLY_POINTS;
}

let WORD_SET: Set<string> | null = null;
export function wordSet(): Set<string> {
    if (!WORD_SET) WORD_SET = new Set(WORDS_RAW.split(/\s+/).filter(w => w.length === WORD_LEN));
    return WORD_SET;
}

export const normaliseWord = (w: string) => String(w || '').toUpperCase().replace(/[^A-Z]/g, '');
export const isWellFormed = (w: string) => /^[A-Z]{5}$/.test(w);
export const isListed = (w: string) => wordSet().has(normaliseWord(w));
/** Anagram key: the word's letters sorted. Same key, same letters → same information. */
export const anagramKey = (w: string) => normaliseWord(w).split('').sort().join('');

/** The answer to a question: one per position whose letter is in the hand. */
export function countIn(word: string, hand: string[]): number {
    const set = new Set(hand);
    return normaliseWord(word).split('').reduce((n, ch) => n + (set.has(ch) ? 1 : 0), 0);
}

// Pastel card colours — one per student, cycling.
export const CARD_COLOURS = ['#ff9aa2', '#ffc28f', '#ffe38f', '#a8e6c4', '#9fd3f5', '#c6b6f7', '#f7b6e0', '#b6f0e6'];
export const colourOf = (letter: string) => CARD_COLOURS[(letter.charCodeAt(0) - 65) % CARD_COLOURS.length];
