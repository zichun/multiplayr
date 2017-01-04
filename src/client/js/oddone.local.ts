/**
 * oddone.local.ts
 */

declare var io;
declare var _mplib;

_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {
    const setupJoin = (roomId) => {
        [0, 1, 2, 3].forEach((i) => {
            const name = 'client' + i + '-container';
            const container = document.getElementById(name);

            const $button = $('<button>Connect</button>').click(() => {
                const transport = new _mplib.LocalClientTransport();
                _mplib.MultiplayR.Join(roomId,
                                       transport,
                                       container);

                $button.text('Connecting...');
                $button.attr('disabled', 'disabled');
            });

            $(container).append($button);
        });
    };

    const transport = new _mplib.LocalClientTransport(
        (data) => {
            _mplib.messages.checkReturnMessage(data, 'clientId');
        });

    _mplib.MultiplayR.Host('theoddone',
                           transport,
                           document.getElementById('host-container'),
                           (res) => {
                               _mplib.messages.checkReturnMessage(res, 'roomId');
                               setupJoin(res.message);
                           });

});
