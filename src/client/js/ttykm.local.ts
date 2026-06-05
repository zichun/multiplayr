/**
 * ttykm.local.ts
 */

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {
    _mplib.DebuggerUI.init({
        gameId: 'ttykm',
        gameName: 'That Time You Killed Me',
        ruleName: 'ttykm-debug',
        defaultClientsCount: 1 // Host + 1 Client = 2 players
    });
});
