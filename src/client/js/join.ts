/**
 * join.ts
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
    let connected = false;
    const $joinButton = $('#join-button');

    $joinButton.hide();

    const transport = new SocketTransport(io,
                                          location.protocol + '//' + location.host,
                                          (data) => {
                                              checkReturnMessage(data, 'clientId');
                                              clientId = data.message;
                                              connected = true;
                                              setupJoinButton(clientId, transport);
                                          });

    const hash = parseHash();
    if (hash.roomId && hash.clientId) {
        $('#roomId').val(hash.roomId);
        $('#clientId').attr('disabled', '').val(hash.clientId);
    }

});

function setupJoinButton(
    clientId: string,
    transport: SocketTransport
) {
    const $joinButton = $('#join-button');

    $joinButton.show();

    $joinButton.click(() => {
        const roomId = $('#roomId').val().trim();
        const clientId = $('#clientId').val().trim();

        $joinButton.attr('disabled', 'disabled');
        $joinButton.text('Connecting...');

        if (clientId) {
            MultiplayR.ReJoin(roomId,
                              clientId,
                              transport,
                              document.body,
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
            MultiplayR.Join(roomId,
                            transport,
                            document.body,
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
