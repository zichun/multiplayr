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
            _mplib.messages.checkReturnMessage(data, 'clientId');
            clientId = data.message;

            Object.keys(_mplib.MPRULES).forEach((rule) => {
                $('#rules').append(makeRule(rule, _mplib.MPRULES[rule]));
            });

            $('#rules').append('<a href="/join" style="font-size:1.5em; margin: 5px;">Join games</a>');
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
            _mplib.MultiplayR.Host(ruleName,
                                   transport,
                                   document.getElementById('rules'));
        };
    }
})
