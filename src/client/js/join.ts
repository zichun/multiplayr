/**
 * join.ts
 *
 */

declare var io;
declare var _mplib;

_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

$(() => {

    let clientId = '';
    let connected = false;
    const $joinButton = $('#join-button');

    $joinButton.hide();

    const transport = new _mplib.SocketTransport(
        {
            io: io,
            uri: location.protocol + '//' + location.host
        },
        (data) => {
            _mplib.messages.checkReturnMessage(data, 'clientId');
            clientId = data.message;
            connected = true;
            setupJoinButton(clientId, transport);
        });

    const hash = parseHash();
    if (hash.roomId && hash.clientId) {
        $('#roomId').val(hash.roomId).change(function() {
            $('#clientId').val('');
        });
        $('#clientId').attr('disabled', '').val(hash.clientId);
    }

});

function setupJoinButton(
    clientId: string,
    transport: any
) {
    const $joinButton = $('#join-button');

    $joinButton.show();

    $joinButton.click(() => {
        const roomId = $('#roomId').val().toString().trim();
        const clientId = $('#clientId').val().toString().trim();

        $joinButton.attr('disabled', 'disabled');
        $joinButton.text('Connecting...');

        if (clientId) {
            _mplib.MultiplayR.ReJoin(_mplib.MPRULES,
                                     roomId,
                                     clientId,
                                     transport,
                                     document.getElementById('container'),
                                     (res) => {
                                         if (!res.success) {
                                             alert(res.message);
                                             $joinButton
                                                 .removeAttr('disabled')
                                                 .text('Join Game');
                                             return;
                                         }

                                         window.location.hash = 'roomId=' + roomId + '&clientId=' + clientId;
                                     });
        } else {
            _mplib.MultiplayR.Join(_mplib.MPRULES,
                                   roomId,
                                   transport,
                                   document.getElementById('container'),
                                   (res) => {
                                       if (!res.success) {
                                           alert(res.message);
                                           $joinButton
                                               .removeAttr('disabled')
                                               .text('Join Game');
                                           return;
                                       }

                                       window.location.hash = 'roomId=' + roomId + '&clientId=' + transport.getClientId();
                                   });
        }
    });

}

function parseHash() {
    const dict = {
        roomId: null,
        clientId: null
    };

    function extractFromHash(
        stri: string,
        key: string,
        dictionary: any
    ) {
        const str = stri.split('=');

        if (str.length !== 2 || str[0].indexOf(key) === -1) {
            return false;
        }

        return (dictionary[key] = str[1]);
    }

    const hash = window.location.hash.split('&');

    if (hash.length !== 2) {
        return dict;
    }

    for (let i = 0; i < hash.length; i = i + 1) {
        extractFromHash(hash[i], 'roomId', dict);
        extractFromHash(hash[i], 'clientId', dict);
    }

    return dict;
}
