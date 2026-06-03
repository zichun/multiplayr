/**
 * catchsketch.local.ts
 */

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {
    _mplib.DebuggerUI.init({
        gameId: 'catchsketch',
        gameName: 'Catch Sketch',
        ruleName: 'catchsketch-debug',
        defaultClientsCount: 4
    });
});
