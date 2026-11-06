/**
 * JJTypes.ts — the view-prop shapes the rule hands to each client.
 *
 * `jj` is built per client from THEIR lane (team): phase, clues, turns and
 * guesses are their own team's. In team mode `rival` describes the other team;
 * its clues/guesses are null until this client's team has finished guessing.
 */

import { ViewPropsInterface } from '../../common/interfaces';
import { Phase, Clue, Signal, RoundRecord, HintSlot, GameEvent } from './JJGameState';
import { Tier, ChallengeId } from './JJData';

export interface JJPlayer { id: string; name: string; accent: string; icon: number; team: number | null; }

export interface JJTeamInfo { name: string; short: string; colour: string; deep: string; score: number; members: string[]; }

export interface JJRival {
    team: number;
    guesserId: string;
    spellerId: string | null;
    status: Phase;               // Spell | Guess | Watch (or the round phase)
    clueCount: number;
    letterCount: number;
    cluesTarget: number;
    visible: boolean;            // may this client see the details below?
    clues: Clue[] | null;
    guesses: string[] | null;
    guessesLeft: number;
    correct: boolean | null;
    overruled: boolean;
}

export interface JJChoose { step: 'any' | 'tier' | 'word'; pickerId: string; tier: Tier | null; }

/** Same for everybody on a lane. Never contains the live secret word. */
export interface JJPublic {
    phase: Phase;                // this client's lane: Choose/Spell/Guess/Watch/Reveal/Done
    round: number;
    rounds: number;
    score: number;               // own team (co-op: the table)
    cluesPerRound: number;
    players: JJPlayer[];
    guesserId: string;
    chooserId: string;
    spellerId: string | null;
    lettersLeft: number;
    cardId: number | null;
    wordIdx: number | null;      // printed number − 1, public once chosen
    clues: Clue[];
    cluesTarget: number;
    guesses: string[];
    guessesLeft: number;
    correct: boolean;
    overruled: boolean;
    wordLength: number | null;   // Spotlight
    firstLetter: string | null;  // First Dibs
    signals: Signal[];           // own team's Jibber!/Jabble?
    emotes: Signal[];            // everybody's faces
    hintsEnabled: boolean;
    cardMode: 'fixed' | 'mixed';
    hints: Record<string, HintSlot>;
    history: RoundRecord[];      // own team
    tierCounts: Record<Tier, number>;
    rank: { idx: number; title: string };
    challenges: Record<ChallengeId, boolean>;
    lastEvent: GameEvent | null;

    // team mode
    teamMode: boolean;
    myTeam: number | null;
    teams: JJTeamInfo[] | null;
    rival: JJRival | null;
    choose: JJChoose | null;
    allHistory: RoundRecord[];   // both teams, minus anything this client may not see yet
    winner: number | null;
}

/** Only for this client. */
export interface JJPrivate {
    me: string;
    isHost: boolean;
    isGuesser: boolean;
    cardWords: string[] | null;  // null for a Guesser until their team has guessed
    secret: string | null;       // null for a Guesser until their team has guessed
    hintUsable: boolean;
}

export interface JJViewProps extends ViewPropsInterface {
    jj: JJPublic;
    my: JJPrivate;
}

/** Lobby roster, sent to everybody (host + clients). */
export interface JJLobbyInfo {
    mode: 'coop' | 'teams';
    players: JJPlayer[];
    teams: string[][];
}
