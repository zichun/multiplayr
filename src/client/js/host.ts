/**
 * host.ts
 *
 * entry point for host
 *
 */

import { ROOMINACTIVELIFESPAN } from '../../common/constants';

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
            const sessionStore = _mplib.savedsessions.getSessionStore();
            if (!sessionStore) {
                return showRules(data);
            }

            // Offer to resume the most recently hosted game while its server room can
            // still be alive. Declining keeps it in the saved sessions.
            sessionStore.list().then((sessions) => {
                const latest = sessions[0];
                if (latest && _mprules.MPRULES[latest.ruleName] &&
                    Date.now() - latest.updatedAt < ROOMINACTIVELIFESPAN &&
                    confirm('An existing game at room ' + latest.roomId + ' (' + latest.ruleName + ') detected. Click OK to resume the game, and cancel to host a new game')) {
                    sessionStore.touch(latest.sessionId);
                    return rehost(latest.ruleName, latest.roomId, latest.clientId, latest.gameState, data);
                }
                showRules(data);
            }).catch((err) => {
                console.error('Failed to read saved games', err);
                showRules(data);
            });
        });

    function showRules(data: any) {
        _mplib.messages.checkReturnMessage(data, 'clientId');
        clientId = data.message;

        Object.keys(_mprules.MPRULES).forEach((ruleName) => {
            const rule = _mprules.MPRULES[ruleName];
            if (!rule.debug) {
                $('#rules').append(makeRule(ruleName, rule));
            }
        });

        $('#rules').append('<a href="/join" style="font-size:1.5em; margin: 5px;">Join games</a>');
    }

    function rehost(
        ruleName: string,
        roomId: string,
        clientId: string,
        gameState: string,
        connectData: any
    ) {
        _mplib.MultiplayR.ReHost(ruleName,
                                 roomId,
                                 clientId,
                                 gameState,
                                 transport,
                                 document.getElementById('rules'),
                                 (res) => {
                                     if (res && res.success === false) {
                                         alert('Could not resume the game: ' + res.message);
                                         showRules(connectData);
                                     }
                                 });
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
