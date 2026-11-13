/**
 * CKTypes.ts — the view-prop contract between the rule tick and the views.
 */

import { Item, LocId, CriticId, RumorId, RestId, CKOptions, IngType } from './CKData';
import { Phase, Placement, LogEntry, ChefKey, StarEntry, ChallengeResult } from './CKGameState';
import { ChallengePlate, CriticPlate, FinalResult, MealCtx } from './CKMeals';

export interface CKPlayerPub {
    id: string;
    name: string;
    accent: string;
    stars: number;
    starLog: StarEntry[];
    rest: RestId | null;
    zous: string[];
    zousNext: string[];
    known: boolean[];
    rumorTokens: number;
    storageCount: number;
    ready: boolean;
    challengeResults: ChallengeResult[];
    /** revealed only at game over */
    storage?: Item[];
    criticPlate?: CriticPlate | null;
}

export interface CKChallengeSlot {
    id: string | null;
    held: boolean;
    revealed: boolean;
}

export interface CKPublic {
    phase: Phase;
    round: number;
    day: number;
    options: CKOptions;
    critic: CriticId;
    challenges: CKChallengeSlot[];
    hippo: string | null;
    revealed: boolean[];
    /** rumor card ids, only for slots flipped face up */
    rumorFaces: (RumorId | null)[];
    locations: LocId[];
    locItems: Record<string, Item[]>;
    priority: string[];
    order: string[];
    players: Record<string, CKPlayerPub>;
    placements: Record<string, Placement[]>;
    shopLoc: LocId | null;
    resolved: LocId[];
    pending: { pid: string; key: ChefKey; loc: LocId; kind: 'pick' | 'penny'; picksLeft: number } | null;
    picked: Record<string, number>;
    offered: { id: string; req: IngType[]; hippo: boolean }[];
    waitingOn: string[];
    fridgeLimit: number;
    log: LogEntry[];
    final: FinalResult[] | null;
    winners: string[];
    allRumors: RumorId[] | null;
}

export interface CKPrivate {
    me: string;
    isHost: boolean;
    isPlayer: boolean;
    storage: Item[];
    criticPool: Item[];
    plan: Record<ChefKey, LocId> | null;
    restOptions: RestId[];
    /** rumor card per slot that I know */
    rumorTexts: (RumorId | null)[];
    jamie: RumorId | null;
    options: number[];
    canLeave: boolean;
    canStar: boolean;
    challengePlates: ChallengePlate[] | null;
    criticPlate: CriticPlate | null;
    fridgeDiscard: number[] | null;
    overLimit: number;
    ctx: MealCtx | null;
    chefKeys: ChefKey[];
}
