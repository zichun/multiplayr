/**
 * host.ts
 *
 * entry point for host
 *
 */

declare var io;
declare var _mplib;

_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {

    let clientId = '';
    const transport = new _mplib.SocketTransport(
        {
            io: io,
            uri: location.protocol + '//' + location.host
        },
        (data) => {
            if (sessionStorage.getItem('gameState') &&
                sessionStorage.getItem('roomId') &&
                sessionStorage.getItem('clientId') &&
                sessionStorage.getItem('ruleName')) {

                const roomId = sessionStorage.getItem('roomId');
                const ruleName = sessionStorage.getItem('ruleName');
                const clientId = sessionStorage.getItem('clientId');
                const gameState = sessionStorage.getItem('gameState');

                if (confirm('An existing game at room ' + roomId + ' (' + ruleName + ') detected. Click OK to resume the game, and cancel to host a new game')) {
                    return rehost(_mplib.MPRULES[ruleName], roomId, clientId, gameState);
                }
            }

            _mplib.messages.checkReturnMessage(data, 'clientId');
            clientId = data.message;

            Object.keys(_mplib.MPRULES).forEach((ruleName) => {
                const rule = _mplib.MPRULES[ruleName];
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
        _mplib.MultiplayR.ReHost(_mplib.MPRULES[ruleName],
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
            _mplib.MultiplayR.Host(_mplib.MPRULES[ruleName],
                                   transport,
                                   document.getElementById('rules'));
        };
    }

});
