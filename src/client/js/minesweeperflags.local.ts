/**
 * minesweeperflags.local.ts
 */

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {

    $('#res-select').on('change', (evt) => {
        const style = $(evt.target).val().toString();
        $('#clients').attr('class', style);
    });

    const setupJoin = (roomId) => {
        const container = document.getElementById('client-container');

        const $button = $('<button>Connect</button>').click(() => {
            const transport = new _mplib.LocalClientTransport();
            _mplib.MultiplayR.Join(
                roomId,
                transport,
                container);

            $button.text('Connecting...');
            $button.attr('disabled', 'disabled');
        });

        $(container).append($button);
    };

    const transport = new _mplib.LocalClientTransport(
        (data) => {
            _mplib.messages.checkReturnMessage(data, 'clientId');
        });

    const statesS = sessionStorage.getItem('debuggerGameStates');

    _mplib.MultiplayR.Host(
        'minesweeperflags-debug',
        transport,
        document.getElementById('host-container'),
        (res) => {
            _mplib.messages.checkReturnMessage(res, 'roomId');
            setupJoin(res.message);

            if (statesS) {
                const states = JSON.parse(statesS);
                const state = states[states.length - 1];
                const players = Object.keys(JSON.parse(state).clientsStore).length;

                for (let i = 0; i < players; i = i + 1) {
                    $('#client' + i + '-container button').click();
                }
            }
        });
});
