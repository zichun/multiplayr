/**
 * host.ts
 *
 * entry point for host
 *
 */

import MultiplayR from '../lib/multiplayr';
import SocketTransport from '../lib/socket.transport';
import Session from '../lib/session';
import {checkReturnMessage} from '../../common/messages';
import MPRULES from '../../rules/rules';

declare var io;

MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {

    let clientId = '';
    const transport = new SocketTransport(io,
                                          location.protocol + '//' + location.host,
                                          (data) => {
                                              checkReturnMessage(data, 'clientId');
                                              clientId = data.message;

                                              Object.keys(MPRULES).forEach((rule) => {
                                                  $('#rules').append(makeRule(rule, MPRULES[rule]));
                                              });
                                          });
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
            MultiplayR.Host(ruleName,
                            transport,
                            document.getElementById('rules'));
        };
    }
})
