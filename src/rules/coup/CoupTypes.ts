/**
 * Types for Coup rules
 */

import {
    MPType
} from '../../common/interfaces';

export enum CoupGameState {
    PlayAction = 1,       // A player chooses an action.
    PlayReaction,         // Other players react to the action chooses - challenge / block etc.
    ChallengeReaction,    // Allow challengee to pick a card to reveal.
    ChallengeResult,      // Shows the result of a challenge, and interface for loser to pick losing card.
    AmbassadorCardChange, // Ambassador action - player choose cards to swap.
    GameOver              // Game over screen.
}

export enum CoupAction {
    Duke = 1,    // Take 3 coins from the treasury
    Assassin,    // Pay three coins and try to assassinate another player's character
    Captain,     // Take two coins from another player
    Ambassador,  // Draw two character cards, and choose
    Income,      // Take one coin from the treasury
    ForeignAid,  // Take two coins from the treasury
    Coup         // Spend 7 coins and assassinate an opponent
}

export enum CoupReaction {
    Challenge = 1,
    Block
}

export enum CoupCard {
    Duke = 1,
    Assassin,
    Contessa,
    Captain,
    Ambassador,
    Unknown
}

export enum CoupCardState {
    Active = 1,
    Challenged,
    Assassinated,
    Couped
}

export enum CoupWaitContext {
    PlayAction = 1,
    ChallengeOrBlock,
    ChallengeReaction,
    ChallengeFail,
    AmbassadorChooseCard
}

export interface CoupActionOutcomesInterface {
    clientId: string,
    coins?: number,
    cards?: number
}

export interface CoupActionInterface {
    action: CoupAction,
    clientId: string,
    targetId?: string,
    challenge?: string,
    block?: string,
    challengeResult?: boolean
    challengeLoser?: string,
    challengeWinner?: string,
    challengeCauseDead?: boolean,
    coinStolen?: number,
    complete?: boolean,
    outcomes?: CoupActionOutcomesInterface[]
}

export interface CoupViewPropsInterface {
    MP: MPType,
    actions: CoupActionInterface[],
    playerTurn: number,
    playerTurnId: string
    isDead?: boolean,
    coins: number,
    cards: any,
    alivePlayers: string[],
    playersCards: any,
    playersCoins: number[],
    waitForId?: string,
    waitContext?: CoupWaitContext,
    waitAdditionalText?: string,
    drawCards: any,
    winner: string,
    lobby: any,
    gameobject: any
}
