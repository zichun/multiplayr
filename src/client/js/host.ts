/**
 * host.ts
 *
 * entry point for host
 *
 */

export {};

/* eslint-disable no-var */
declare var io;
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {

    let clientId = '';
    const transport = new _mplib.SocketTransport(
        {
            io: io,
            uri: location.protocol + '//' + location.host
        },
        (data) => {
            if (localStorage.getItem('gameState') &&
                localStorage.getItem('roomId') &&
                localStorage.getItem('clientId') &&
                localStorage.getItem('ruleName')) {

                const roomId = localStorage.getItem('roomId');
                const ruleName = localStorage.getItem('ruleName');
                const clientId = localStorage.getItem('clientId');
                const gameState = localStorage.getItem('gameState');

                if (confirm('An existing game at room ' + roomId + ' (' + ruleName + ') detected. Click OK to resume the game, and cancel to host a new game')) {
                    return rehost(ruleName, roomId, clientId, gameState);
                } else {
                    localStorage.removeItem('gameState');
                    localStorage.removeItem('roomId');
                    localStorage.removeItem('clientId');
                    localStorage.removeItem('ruleName');
                }
            }

            _mplib.messages.checkReturnMessage(data, 'clientId');
            clientId = data.message;

            Object.keys(_mprules.MPRULES).forEach((ruleName) => {
                const rule = _mprules.MPRULES[ruleName];
                if (!rule.debug) {
                    $('#rules').append(makeRule(ruleName, rule));
                }
            });

            $('#rules').append('<a href="/join" style="font-size:1.5em; margin: 5px;">Join games</a>');
        });

    function rehost(
        ruleName: string,
        roomId: string,
        clientId: string,
        gameState: string
    ) {
        _mplib.MultiplayR.ReHost(ruleName,
                                 roomId,
                                 clientId,
                                 gameState,
                                 transport,
                                 document.getElementById('rules'));
    }

    function makeRule(
        name: string,
        rule: any
    ) {
        const $rule = $('<div class="rule" />');

        $('<header class="name">' + name + '</header>').appendTo($rule);
        $('<div class="desc">' + rule.description + '</div>').appendTo($rule);
        $('<button class="host">Host this game!</button>')
            .click(hostGame(name))
            .appendTo($rule);

        return $rule;
    }

    function hostGame(
        ruleName: string
    ) {
        return () => {
            _mplib.MultiplayR.Host(ruleName,
                                   transport,
                                   document.getElementById('rules'));
        };
    }

});
