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

    // Check if we can resume an existing P2P game from localStorage
    if (localStorage.getItem('gameState') &&
        localStorage.getItem('roomId') &&
        localStorage.getItem('clientId') &&
        localStorage.getItem('ruleName')) {

        const roomId = localStorage.getItem('roomId');
        const ruleName = localStorage.getItem('ruleName');
        const savedClientId = localStorage.getItem('clientId');
        const gameState = localStorage.getItem('gameState');

        const displayRoomId = roomId.startsWith('mp-') ? roomId.substring(3) : roomId;
        if (confirm('An existing P2P game at room ' + displayRoomId + ' (' + ruleName + ') detected. Click OK to resume the game, and cancel to host a new game.')) {
            console.log(`Attempting to resume P2P game at room ${roomId}...`);
            
            transportOpts.customPeerId = savedClientId;
            const transport = new _mplib.WebRTCTransport(
                transportOpts,
                (data) => {
                    _mplib.messages.checkReturnMessage(data, 'clientId');

                    // Update UI status
                    const displayId = savedClientId.startsWith('mp-') ? savedClientId.substring(3) : savedClientId;
                    $('#room-info')
                        .removeClass('connecting')
                        .addClass('connected')
                        .text('Host P2P is established. Room Code: ' + displayId);

                    // Hide host setup UI, show game container, and set hash
                    $('#host-setup-ui').hide();
                    $('#game-container').show().empty();
                    location.hash = ruleName;

                    // Rehost the game using the saved state
                    _mplib.MultiplayR.ReHost(
                        ruleName,
                        roomId,
                        savedClientId,
                        gameState,
                        transport,
                        document.getElementById('game-container')
                    );
                }
            );
            return;
        } else {
            // Clean up local storage if the user chooses to start fresh
            localStorage.removeItem('gameState');
            localStorage.removeItem('roomId');
            localStorage.removeItem('clientId');
            localStorage.removeItem('ruleName');
        }
    }

    // Instantiate WebRTC Transport (fresh game hosting)
    const transport = new _mplib.WebRTCTransport(
        transportOpts,
        (data) => {
            _mplib.messages.checkReturnMessage(data, 'clientId');
            clientId = data.message;

            // Update UI status
            const displayId = clientId.startsWith('mp-') ? clientId.substring(3) : clientId;
            $('#room-info')
                .removeClass('connecting')
                .addClass('connected')
                .text('Host P2P is established. Room Code: ' + displayId);

            // Define categories
            const categories = [
                { title: '2 Players Only', maxLimit: 2, rules: [] },
                { title: 'Up to 4 Players', maxLimit: 4, rules: [] },
                { title: 'Up to 6 Players', maxLimit: 6, rules: [] },
                { title: 'Up to 8 Players', maxLimit: 8, rules: [] },
                { title: 'Party Games (9+ Players)', maxLimit: Infinity, rules: [] }
            ];

            // Distribute rules into categories
            Object.keys(_mprules.MPRULES).forEach((ruleName) => {
                const rule = _mprules.MPRULES[ruleName];
                if (!rule.debug) {
                    const maxPlayers = rule.maxPlayers || 2; // default fallback
                    const category = categories.find(cat => maxPlayers <= cat.maxLimit);
                    if (category) {
                        category.rules.push({ name: ruleName, rule });
                    }
                }
            });

            // Clear and render by category
            const $rulesContainer = $('#rules').empty();

            categories.forEach((cat) => {
                if (cat.rules.length === 0) return;

                // Sort rules within category alphabetically by game name
                cat.rules.sort((a, b) => {
                    const nameA = a.name.toLowerCase();
                    const nameB = b.name.toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                const $section = $('<section class="category-section" />');
                $('<h2 class="category-title">' + cat.title + '</h2>').appendTo($section);
                
                const $grid = $('<div class="rules-grid" />');
                cat.rules.forEach((item) => {
                    $grid.append(makeRule(item.name, item.rule));
                });
                
                $grid.appendTo($section);
                $rulesContainer.append($section);
            });
        }
    );

    function makeRule(name: string, rule: any) {
        const $rule = $('<div class="rule" />')
            .click(hostGame(name));
        
        const $content = $('<div class="rule-content" />').appendTo($rule);

        const prettyName = name.charAt(0).toUpperCase() + name.slice(1);
        const displayName = rule.icon ? `${rule.icon} ${prettyName}` : prettyName;

        $('<header class="name">' + displayName + '</header>').appendTo($content);
        $('<div class="desc">' + rule.description + '</div>').appendTo($content);

        // Render player count badge
        let playersText = '';
        if (rule.minPlayers && rule.maxPlayers) {
            if (rule.minPlayers === rule.maxPlayers) {
                playersText = `${rule.minPlayers} players`;
            } else {
                playersText = `${rule.minPlayers}-${rule.maxPlayers} players`;
            }
            const $badge = $('<div class="player-count-badge"><i class="fa fa-users"></i> ' + playersText + '</div>');
            $badge.appendTo($rule);
        }

        return $rule;
    }

    function hostGame(ruleName: string) {
        return () => {
            // Hide host setup UI, show game container, and set hash
            $('#host-setup-ui').hide();
            $('#game-container').show().empty();
            location.hash = ruleName;

            // host game through WebRTCTransport
            _mplib.MultiplayR.Host(
                ruleName,
                transport,
                document.getElementById('game-container')
            );
        };
    }

    // Listen to history / back button navigation
    window.addEventListener('hashchange', () => {
        if (!location.hash) {
            location.reload();
        }
    });
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
