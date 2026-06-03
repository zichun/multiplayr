/**
 * ito.local.ts
 */

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {
    _mplib.DebuggerUI.init({
        gameId: 'ito',
        gameName: 'Ito',
        ruleName: 'ito-debug',
        defaultClientsCount: 4
    });
});
