/**
 * host_p2p.ts
 *
 * WebRTC entry point for host.
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

    // Resolve robust WebRTC transport configurations
    const iceServers = getIceServersConfig();
    const transportOpts: any = { iceServers };

    // Check if we can resume an existing P2P game from sessionStorage
    if (sessionStorage.getItem('gameState') &&
        sessionStorage.getItem('roomId') &&
        sessionStorage.getItem('clientId') &&
        sessionStorage.getItem('ruleName')) {

        const roomId = sessionStorage.getItem('roomId');
        const ruleName = sessionStorage.getItem('ruleName');
        const savedClientId = sessionStorage.getItem('clientId');
        const gameState = sessionStorage.getItem('gameState');

        if (confirm('An existing P2P game at room ' + roomId + ' (' + ruleName + ') detected. Click OK to resume the game, and cancel to host a new game.')) {
            console.log(`Attempting to resume P2P game at room ${roomId}...`);
            
            transportOpts.customPeerId = savedClientId;
            const transport = new _mplib.WebRTCTransport(
                transportOpts,
                (data) => {
                    _mplib.messages.checkReturnMessage(data, 'clientId');

                    // Update UI to display Room ID
                    $('#room-info').html(
                        `P2P Room Active! Share Room ID to join: <span id="room-id-display">${savedClientId}</span>`
                    );

                    // Rehost the game using the saved state
                    _mplib.MultiplayR.ReHost(
                        ruleName,
                        roomId,
                        savedClientId,
                        gameState,
                        transport,
                        document.getElementById('rules')
                    );
                }
            );
            return;
        } else {
            // Clean up session storage if the user chooses to start fresh
            sessionStorage.removeItem('gameState');
            sessionStorage.removeItem('roomId');
            sessionStorage.removeItem('clientId');
            sessionStorage.removeItem('ruleName');
        }
    }

    // Instantiate WebRTC Transport (fresh game hosting)
    const transport = new _mplib.WebRTCTransport(
        transportOpts,
        (data) => {
            _mplib.messages.checkReturnMessage(data, 'clientId');
            clientId = data.message;

            // Update UI to display Room ID
            $('#room-info').html(
                `P2P Room Active! Share Room ID to join: <span id="room-id-display">${clientId}</span>`
            );

            // Render rule choices
            Object.keys(_mprules.MPRULES).forEach((ruleName) => {
                const rule = _mprules.MPRULES[ruleName];
                if (!rule.debug) {
                    $('#rules').append(makeRule(ruleName, rule));
                }
            });

            // Add simple link to Join P2P page
            $('#rules').append(
                '<a href="/join_p2p" style="font-size:1.5em; margin: 20px; display: block; text-align: center;">Join P2P Games</a>'
            );
        }
    );

    function makeRule(name: string, rule: any) {
        const $rule = $('<div class="rule" />');

        $('<header class="name">' + name + '</header>').appendTo($rule);
        $('<div class="desc">' + rule.description + '</div>').appendTo($rule);
        $('<button class="host">Host this game!</button>')
            .click(hostGame(name))
            .appendTo($rule);

        return $rule;
    }

    function hostGame(ruleName: string) {
        return () => {
            // host game through WebRTCTransport
            _mplib.MultiplayR.Host(
                ruleName,
                transport,
                document.getElementById('rules')
            );
        };
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
