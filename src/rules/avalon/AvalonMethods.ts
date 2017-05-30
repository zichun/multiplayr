/**
 * AvalonMethods.ts
 */

import {
    shuffle,
    contains
} from '../../common/utils';

import {
    AvalonGameState,
    AvalonCharacter,
    AvalonQuest,
    AvalonQuestStatus,
    AvalonGameOutcome
} from './AvalonTypes';

import {
    AvalonQuestMembers,
    AvalonGoodEvilDistribution,
    NewRound,
    PushQuestData,
    IsWin,
    IsLose,
    WinGame,
    LoseGame
} from './AvalonUtils';

import {
    MPType
} from '../../common/interfaces';

export const AvalonStartGame = (mp: MPType) => {
    if (mp.playersCount() < 5) {
        alert('We need at least 5 players to play this game');
    } else {
        mp.newGame();
        mp.setData('lobby_started', true);
    }
};

export const AvalonNewGame = (mp: MPType) => {
    const playerDeck = [];
    playerDeck.push(AvalonCharacter.Merlin);

    for (let i = 0; i < AvalonGoodEvilDistribution[mp.playersCount()][0] - 1; i = i + 1) {
        playerDeck.push(AvalonCharacter.LoyalServant);
    }

    for (let i = 0; i < AvalonGoodEvilDistribution[mp.playersCount()][1]; i = i + 1) {
        playerDeck.push(AvalonCharacter.Minion);
    }

    shuffle(playerDeck);

    mp.playersForEach((clientId, i) => {
        mp.setPlayerData(clientId, 'character', playerDeck[i]);
    });

    mp.setData('currentQuest', 0);
    mp.setData('quests', []);
    mp.setData('currentLeader', Math.floor(Math.random() * mp.playersCount()));

    NewRound(mp);
};

export const AvalonUpdateQuestMembers = (
    mp: MPType,
    clientId: string,
    members: number[]
) => {

    for (let i = 0; i < members.length; i = i + 1)
    {
        if (members[i] < 0 || members[i] >= mp.playersCount() || members[i] === undefined)
        {
            throw (new Error('Invalid quest member: ' + members[i]));
        }
    }

    mp.setData('currentTeam', members);
};

export const AvalonCommitTeam = (
    mp: MPType
) => {

    const members = mp.getData('currentTeam');
    const currentQuest = mp.getData('currentQuest');
    const quests : AvalonQuest[] = mp.getData('quests');
    const state = mp.getData('state');

    if (state !== AvalonGameState.ChooseQuestMembers) {
        throw (new Error('Cannot commit team from state: ' + state));
    }

    if (members.length !== AvalonQuestMembers[mp.playersCount()][currentQuest]) {
        throw (new Error('Insufficient quest members'));
    }

    for (let i = 0; i < members.length; i = i + 1) {
        if (members[i] < 0 || members[i] >= mp.playersCount() || members[i] === undefined) {
            throw (new Error('Invalid quest member: ' + members[i]));
        }
    }

    let rejectedCount = 0;
    for (let i = quests.length - 1; i >= 0; i = i - 1) {
        if (quests[i].questStatus !== AvalonQuestStatus.TeamRejected) {
            break;
        }
        rejectedCount++;
    }

    if (rejectedCount >= 4) {
        mp.setData('state', AvalonGameState.VoteQuest);
    } else {
        mp.setData('state', AvalonGameState.VoteQuestMembers);
    }
};

export const AvalonCommitTeamVote = (
    mp: MPType,
    clientId: string,
    vote: string
) => {
    if (mp.getData('state') !== AvalonGameState.VoteQuestMembers) {
        throw (new Error('Cannot commit team vote from current state'));
    }

    if (vote !== 'Pass' && vote !== 'Fail') {
        throw (new Error('Invalid team vote ' + vote));
    }

    if (mp.getPlayerData(clientId, 'voteQuestMembers') !== null) {
        throw (new Error('Client ' + clientId + ' already voted for quest members'));
    }

    mp.setPlayerData(clientId, 'voteQuestMembers', vote === 'Pass');

    const playersVote = mp.getPlayersData('voteQuestMembers');
    let accept = 0;
    let reject = 0;

    for (let i = 0; i < mp.playersCount(); i = i + 1) {
        if (playersVote[i] === true) {
            accept = accept + 1;
        } else if (playersVote[i] === false) {
            reject = reject + 1;
        }
    }

    if (accept + reject < mp.playersCount()) {
        return;
    }

    if (reject > accept) {

        // Team got rejected.
        PushQuestData(mp,
                      mp.getData('currentQuest'),
                      mp.getData('currentLeader'),
                      mp.getData('currentTeam'),
                      playersVote,
                      null,
                      AvalonQuestStatus.TeamRejected);
        NewRound(mp);

    } else {

        // Team is accepted.
        mp.setData('state', AvalonGameState.VoteQuest);
    }
}

export const AvalonCommitQuestVote = (
    mp: MPType,
    clientId: string,
    vote: string
) => {
    if (mp.getData('state') !== AvalonGameState.VoteQuest) {
        throw (new Error('Cannot commit team vote from current state'));
    }

    if (vote !== 'Pass' && vote !== 'Fail') {
        throw (new Error('Invalid team vote ' + vote));
    }

    if (mp.getPlayerData(clientId, 'voteQuest') !== null) {
        throw (new Error('Client ' + clientId + ' already voted for quest'));
    }

    mp.playersForEach((cId, index) => {
        if (cId === clientId) {
            if (!contains(mp.getData('currentTeam'), index.toString())) {
                throw (new Error('Client ' + clientId + ' is not in current team'));
            }
        }
    });

    mp.setPlayerData(clientId, 'voteQuest', vote === 'Pass');

    const playersVote = mp.getPlayersData('voteQuest');
    const currentQuest = mp.getData('currentQuest');
    let accept = 0;
    let reject = 0;

    for (let i = 0; i < mp.playersCount(); i = i + 1) {
        if (playersVote[i] === true) {
            accept = accept + 1;
        } else if (playersVote[i] === false) {
            reject = reject + 1;
        }
    }

    const requiredMembers = AvalonQuestMembers[mp.playersCount()][currentQuest];

    if (accept + reject < requiredMembers) {
        return;
    }

    let requiredRejection = 1;

    if (mp.playersCount() >= 7 && currentQuest === 4) {
        requiredRejection = 2;
    }

    if (reject >= requiredRejection) {

        // Quest failed.
        PushQuestData(mp,
                      mp.getData('currentQuest'),
                      mp.getData('currentLeader'),
                      mp.getData('currentTeam'),
                      mp.getPlayersData('voteQuestMembers'),
                      playersVote,
                      AvalonQuestStatus.QuestFailed);

        if (IsLose(mp)) {
            LoseGame(mp);
        } else {
            mp.setData('currentQuest', currentQuest + 1);
            NewRound(mp);
        }

    } else {

        // Quest succeeded.
        PushQuestData(mp,
                      mp.getData('currentQuest'),
                      mp.getData('currentLeader'),
                      mp.getData('currentTeam'),
                      mp.getPlayersData('voteQuestMembers'),
                      playersVote,
                      AvalonQuestStatus.QuestSucceeded);

        if (IsWin(mp)) {
            WinGame(mp);
        } else {
            mp.setData('currentQuest', currentQuest + 1);
            NewRound(mp);
        }
    }
}

export const AvalonChooseMerlin = (
    mp: MPType,
    clientId: string,
    merlin: string
) => {

    if (mp.getData('state') !== AvalonGameState.ChooseMerlin) {
        throw (new Error('Cannot commit team vote from current state'));
    }

    let foundMerlin = false;
    mp.playersForEach((clientId, index) => {
        if (index.toString() === merlin) {
            if (mp.getPlayerData(clientId, 'character') === AvalonCharacter.Merlin) {
                foundMerlin = true;
            }
        }
    });

    if (foundMerlin) {
        mp.setData('gameOutcome', AvalonGameOutcome.MerlinFound);
    } else {
        mp.setData('gameOutcome', AvalonGameOutcome.ArthurWin);
    }

    mp.setData('state', AvalonGameState.GameOver);
};
