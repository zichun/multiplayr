/**
 * clever.local.ts
 */

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {
    _mplib.DebuggerUI.init({
        gameId: 'clever',
        gameName: 'Clever',
        ruleName: 'clever-debug',
        defaultClientsCount: 2 // Host + 2 Clients = 3 players
    });
});
