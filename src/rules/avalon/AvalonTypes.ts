/**
 * AvalonTypes.ts - Types for avalon rule
 */

import {
    ViewPropsInterface
} from '../../common/interfaces';

export enum AvalonGameState {
    ChooseQuestMembers,
    VoteQuestMembers,
    VoteQuest,
    ChooseMerlin,
    GameOver
}

export enum AvalonGameOutcome {
    MinionWin,
    ArthurWin,
    MerlinFound
}

export enum AvalonCharacter {
    Merlin,
    LoyalServant,
    Minion
}

export enum AvalonQuestStatus {
    TeamRejected,
    QuestFailed,
    QuestSucceeded
}

export interface AvalonQuest {
    quest: number,
    leader: number,
    teamMembers: string[],
    teamVote: any,
    questVote: any,
    questStatus: AvalonQuestStatus
}

export interface AvalonViewPropsInterface extends ViewPropsInterface {
    lobby: any;

    status: string;
    leader: number;
    requiredMembers: number;
    currentQuest: number;
    currentTeam: string[],
    voteType: string,
    character: AvalonCharacter,
    minions: number[],
    quests: AvalonQuest[],
    notification: boolean,
    chooseMerlin: boolean
}
