/**
 * tictactoepoker.local.ts
 */

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {
    _mplib.DebuggerUI.init({
        gameId: 'tictactoepoker',
        gameName: 'Tic-Tac-Toe Poker',
        ruleName: 'tictactoepoker-debug',
        defaultClientsCount: 2
    });
});
