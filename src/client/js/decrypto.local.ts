/**
 * decrypto.local.ts
 */

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {
    _mplib.DebuggerUI.init({
        gameId: 'decrypto',
        gameName: 'Decrypto',
        ruleName: 'decrypto-debug',
        defaultClientsCount: 8
    });
});
