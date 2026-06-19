/**
 * join_p2p.ts
 *
 * WebRTC entry point for joining players.
 */

export {};

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

declare var process: any;

$(() => {
    let clientId = '';
    const $joinButton = $('#join-button');

    $joinButton.hide();

    // Resolve robust WebRTC transport configurations
    const iceServers = getIceServersConfig();
    const transportOpts: any = { iceServers };

    const hash = parseHash();
    if (hash.roomId && hash.clientId) {
        // Normalize roomId prefix
        const fullRoomId = hash.roomId.startsWith('mp-') ? hash.roomId : 'mp-' + hash.roomId;
        // Pre-populate input fields with stripped display code
        const displayRoomId = hash.roomId.startsWith('mp-') ? hash.roomId.substring(3) : hash.roomId;
        $('#roomId').val(displayRoomId);
        $('#clientId').val(hash.clientId);
        $joinButton.show().attr('disabled', 'disabled').text('Reconnecting...');

        console.log(`Auto-rejoining Room ${fullRoomId} with Client ID ${hash.clientId}...`);

        // Instantiate WebRTC Transport with the saved client ID
        transportOpts.customPeerId = hash.clientId;
        const transport = new _mplib.WebRTCTransport(
            transportOpts,
            (data) => {
                _mplib.messages.checkReturnMessage(data, 'clientId');
                clientId = data.message;

                // Automatically attempt to rejoin
                _mplib.MultiplayR.ReJoin(
                    fullRoomId,
                    clientId,
                    transport,
                    document.getElementById('container'),
                    (res) => {
                        if (!res.success) {
                            console.error('Auto-rejoin failed:', res.message);
                            $('#error').text('Auto-rejoin failed: ' + res.message);
                            setupJoinButton(clientId, transport, hash.clientId);
                            return;
                        }

                        // Connection successful! Hide join form
                        $('#join').hide();
                    }
                );
            }
        );
    } else {
        if (hash.roomId) {
            const displayRoomId = hash.roomId.startsWith('mp-') ? hash.roomId.substring(3) : hash.roomId;
            $('#roomId').val(displayRoomId);
        }

        // Standard flow: dynamic client ID generation, wait for button click
        const transport = new _mplib.WebRTCTransport(
            transportOpts,
            (data) => {
                _mplib.messages.checkReturnMessage(data, 'clientId');
                clientId = data.message;
                $('#clientId').val(clientId);
                setupJoinButton(clientId, transport);
            }
        );
    }
});

function getIceServersConfig() {
    // Check Webpack injected DefinePlugin variables (from local .env file during build)
    const envUrl = process.env.TURN_URL || '';
    const envUsername = process.env.TURN_USERNAME || '';
    const envCredential = process.env.TURN_CREDENTIAL || '';

    if (envUrl) {
        console.log('Using WebRTC credentials injected securely at build-time:', envUrl);
        const servers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ];

        const stunUrl = envUrl.replace(/^turn:/i, 'stun:');
        servers.push({
            urls: stunUrl,
            username: envUsername || undefined,
            credential: envCredential || undefined
        } as any);

        servers.push({
            urls: envUrl,
            username: envUsername || undefined,
            credential: envCredential || undefined
        } as any);
        return servers;
    }

    // Fallback default STUN configuration
    console.log('Using default public STUN configurations.');
    return [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ];
}

function setupJoinButton(clientId: string, transport: any, savedClientId?: string) {
    const $joinButton = $('#join-button');
    $joinButton.show().removeAttr('disabled').text('Join Game');

    // Unbind any previous click handlers to prevent duplicates
    $joinButton.off('click').click(() => {
        const rawRoomId = $('#roomId').val().toString().trim();

        if (!rawRoomId) {
            $('#error').text('Please enter a Host Room ID.');
            return;
        }

        const roomId = rawRoomId.startsWith('mp-') ? rawRoomId : 'mp-' + rawRoomId;

        $joinButton.attr('disabled', 'disabled');
        $joinButton.text('Connecting P2P to Host...');
        $('#error').html('&nbsp;');

        const rejoinId = savedClientId || $('#clientId').val().toString().trim();

        if (rejoinId) {
            _mplib.MultiplayR.ReJoin(
                roomId,
                rejoinId,
                transport,
                document.getElementById('container'),
                (res) => {
                    if (!res.success) {
                        $('#error').text(res.message);
                        $joinButton.removeAttr('disabled').text('Join Game');
                        return;
                    }

                    // Connection successful! Hide join form and update hash
                    $('#join').hide();
                    window.location.hash = 'roomId=' + roomId + '&clientId=' + rejoinId;
                }
            );
        } else {
            _mplib.MultiplayR.Join(
                roomId,
                transport,
                document.getElementById('container'),
                (res) => {
                    if (!res.success) {
                        $('#error').text(res.message);
                        $joinButton.removeAttr('disabled').text('Join Game');
                        return;
                    }

                    // Connection successful! Hide join form and update hash
                    $('#join').hide();
                    window.location.hash = 'roomId=' + roomId + '&clientId=' + transport.getClientId();
                }
            );
        }
    });
}

function parseHash() {
    const dict = {
        roomId: null,
        clientId: null
    };

    function extractFromHash(stri: string, key: string, dictionary: any) {
        const str = stri.split('=');

        if (str.length !== 2 || str[0].indexOf(key) === -1) {
            return false;
        }

        return (dictionary[key] = str[1]);
    }

    const hash = window.location.hash.split('&');

    for (let i = 0; i < hash.length; i = i + 1) {
        extractFromHash(hash[i], 'roomId', dict);
        extractFromHash(hash[i], 'clientId', dict);
    }

    return dict;
}
