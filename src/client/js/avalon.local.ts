/**
 * avalon.local.ts
 */

declare var io;
declare var _mplib;

_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {

    $('#res-select').on('change', (evt) => {
        const style = $(evt.target).val().toString();
        $('#clients').attr('class', style);
    });

    const clientsCount = 10;

    const setupClients = () => {
        for (let i = 0; i < clientsCount; i = i + 1) {
            const $client = $('<div id="client' + i + '" class="client"> ' +
                            'Client ' + i + ':' +
                            '<div id="client' + i + '-container" class="client-container">' +
                            '</div>');

            $('#clients').append($client);
        }
    };

    setupClients();

    const setupJoin = (roomId) => {
        for (let i = 0; i < clientsCount; i = i + 1) {
            const name = 'client' + i + '-container';
            const container = document.getElementById(name);

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
        }
    };

    const transport = new _mplib.LocalClientTransport(
        (data) => {
            _mplib.messages.checkReturnMessage(data, 'clientId');
        });

    const statesS = sessionStorage.getItem('debuggerGameStates');

    _mplib.MultiplayR.Host(
        'avalon-debug',
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
