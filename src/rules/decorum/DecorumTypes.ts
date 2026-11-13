/**
 * DecorumTypes.ts — the view-prop shapes the rule hands to each client.
 *
 * `dc` is identical for everybody and never holds another player's
 * conditions before the end. `my` is per client: own card and the conditions
 * housemates have shared with you.
 */

import { ViewPropsInterface } from '../../common/interfaces';
import { Phase, LogEntry, Result } from './DecorumGameState';
import { House, Condition, Level, Mood, Board, Beds, Twists, Memo } from './DecorumData';

export interface DCPlayer {
    id: string;
    name: string;
    accent: string;
    icon: number;
    seat: number;
    /** Public "I'm fulfilled" flag, refreshed at each of this player's turns. */
    declared: boolean;
    conditions: number;
    votedEarly: boolean;
    /** During a meeting: has finished sharing (and stating a mood). */
    meetingDone: boolean;
}

export interface DCMeetingPublic {
    idx: number;
    kind: 'h2h' | 'house';
    early: boolean;
    moods: { by: string; mood: Mood; target: string | null }[];
    shares: { from: string; to: string }[];
}

export interface DCPublic {
    gameId: number;
    phase: Phase;
    title: string;
    code: string;
    level: Level;
    players: DCPlayer[];           // seat order: player one first
    board: Board;
    house: House;
    /** Roommates board: beds[seat] = that seat's bedroom (public — the tokens are on the board). */
    beds: Beds | null;
    /** House twists in play (public), and recent turns for the turn-rule twists. */
    twists: Twists;
    memo: Memo;
    activeId: string | null;
    segment: number;
    round: number;
    segments: number[];
    hearts: number;
    totalHearts: number;
    log: LogEntry[];
    meeting: DCMeetingPublic | null;
    canCallEarly: boolean;
    result: Result | null;
    /** Revealed once Done. */
    cards: Record<string, Condition[]> | null;
    solution: House | null;
    solutionBeds: Beds | null;
}

export interface DCKnown { from: string; idx: number; cond: Condition; meeting: number; }

export interface DCPrivate {
    me: string;
    isHost: boolean;
    isPlayer: boolean;
    card: Condition[];
    known: DCKnown[];
    given: { to: string; idx: number; meeting: number }[];
    owesReaction: boolean;
    canReact: boolean;
    canPass: boolean;
    shareOptions: { cond: number; to: string }[];
    myMeeting: { share: { to: string; cond: number } | null; mood: Mood | null; skipped: boolean } | null;
}

export interface DCViewProps extends ViewPropsInterface {
    dc: DCPublic;
    my: DCPrivate;
}

export interface DCLobbyInfo {
    players: { id: string; name: string; accent: string; icon: number }[];
    level: Level;
    code: string;
    twists: boolean;
}
