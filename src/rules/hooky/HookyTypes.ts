/**
 * HookyTypes.ts — the view-prop shapes the rule hands to each client.
 *
 * `hk` is identical for everybody and never holds a hidden card, a peek or a
 * guess before the end. `my` is per client: own hand, own peeks, own guesses.
 */

import { ViewPropsInterface } from '../../common/interfaces';
import { Phase, LogEntry, Peek, HookyResult } from './HookyGameState';
import { Setup } from './HookyData';

export interface HKPlayer {
    id: string;
    name: string;
    accent: string;
    icon: number;
    revealed: string[];
    hiddenCount: number;
}

export interface HKPublic {
    gameId: number;
    phase: Phase;
    round: number;
    setup: Setup;
    players: HKPlayer[];         // in turn order, start player first
    activeId: string | null;
    turn: { asked: boolean; revealed: boolean };
    log: LogEntry[];
    playground: string[];        // face-up Playground cards
    playgroundHidden: number;
    lockedIn: string[];          // Guess phase: who has locked in
    finalSubmitted: string[];
    hooky: string[] | null;      // only once Done
    hands: Record<string, string[]> | null;      // only once Done
    results: HookyResult[] | null;
    hookyGuesses: Record<string, Record<number, string[]>> | null;  // only once Done
}

export interface HKPrivate {
    me: string;
    isHost: boolean;
    isPlayer: boolean;
    hand: string[];
    peeks: Peek[];
    myGuesses: Record<number, string[]>;
    myFinal: Record<string, string[]> | null;
    canReveal: boolean;
    peekTargets: string[];
    /** Anagram keys already used per target — lets the client reject repeats before sending. */
    usedKeys: Record<string, string[]>;
}

export interface HKViewProps extends ViewPropsInterface {
    hk: HKPublic;
    my: HKPrivate;
}

export interface HKLobbyInfo {
    players: { id: string; name: string; accent: string; icon: number }[];
}
