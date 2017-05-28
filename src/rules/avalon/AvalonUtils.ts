/**
 * AvalonUtils.ts
 */

import {
    MPType
} from '../../common/interfaces';

import {
    AvalonGameState,
    AvalonQuestStatus,
    AvalonQuest,
    AvalonCharacter,
    AvalonGameOutcome
} from './AvalonTypes';

export const AvalonQuestMembers = [
    null, null, null, null, null,
    [2, 3, 2, 3, 3],
    [2, 3, 4, 3, 4],
    [2, 3, 3, 4, 4],
    [3, 4, 4, 5, 5],
    [3, 4, 4, 5, 5],
    [3, 4, 4, 5, 5]];

export const AvalonGoodEvilDistribution = [
    null, null, null, null, null,
    [3, 2],
    [4, 2],
    [4, 3],
    [5, 3],
    [6, 3],
    [6, 4]];

export const NewRound = (mp: MPType) => {
    mp.setData('state', AvalonGameState.ChooseQuestMembers);
    mp.setData('currentTeam', []);
    mp.setData('currentLeader', (mp.getData('currentLeader') + 1) % mp.playersCount());

    mp.playersForEach((clientId) => {
        mp.setPlayerData(clientId, 'voteQuestMembers', null);
        mp.setPlayerData(clientId, 'voteQuest', null);
    });

};

export const PushQuestData = (
    mp: MPType,
    quest: number,
    leader: number,
    teamMembers: string[],
    teamVote: any,
    questVote: any,
    questStatus: AvalonQuestStatus
) => {

    const quests: AvalonQuest[] = mp.getData('quests');

    quests.push({
        'quest': quest,
        'leader': leader,
        'teamMembers': teamMembers,
        'teamVote': teamVote,
        'questVote': questVote,
        'questStatus': questStatus
    });

    mp.setData('quests', quests);
};

export const IsLose = (
    mp: MPType
) => {
    const quests : AvalonQuest[] = mp.getData('quests');
    let failed = 0;
    for (let i = 0; i < quests.length; i = i + 1) {
        if (quests[i].questStatus === AvalonQuestStatus.QuestFailed) {
            failed = failed + 1;
        }
    }
    return failed >= 3;
};

export const IsWin = (
    mp: MPType
) => {
    const quests : AvalonQuest[] = mp.getData('quests');
    let succeeded = 0;
    for (let i = 0; i < quests.length; i = i + 1) {
        if (quests[i].questStatus === AvalonQuestStatus.QuestSucceeded) {
            succeeded = succeeded + 1;
        }
    }
    return succeeded >= 3;
};

export const WinGame = (
    mp: MPType
) => {
    mp.setData('state', AvalonGameState.ChooseMerlin);
};

export const LoseGame = (
    mp: MPType
) => {
    mp.setData('state', AvalonGameState.GameOver);
    mp.setData('gameOutcome', AvalonGameOutcome.MinionWin);
};

export const IsMinion = (
    mp: MPType,
    clientId: string
) => {
    return mp.getPlayerData(clientId, 'character') === AvalonCharacter.Minion;
};
