/**
 * theoddone.local.ts
 */

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {
    _mplib.DebuggerUI.init({
        gameId: 'theoddone',
        gameName: 'The Odd One',
        ruleName: 'theoddone-debug',
        defaultClientsCount: 8
    });
});
