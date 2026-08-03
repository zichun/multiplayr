/**
 * host_p2p.ts
 *
 * WebRTC entry point for host.
 */

export {};

import { iconToSvg } from '../lib/card-renderer/iconToSvg';

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

declare var process: any;

// Flat mid-century accents cycled across the game cards. `bg` is the bold banner
// hue (and the watermark tone); `tint` is the same hue washed pale for the card
// body; `fg` is the title colour on the banner.
const CARD_ACCENTS = [
    { bg: '#e3a81e', fg: '#221f1a', tint: '#f6ecd2' }, // mustard
    { bg: '#1c8c7d', fg: '#fbf8f1', tint: '#d7e9e5' }, // teal
    { bg: '#e1553a', fg: '#fbf8f1', tint: '#f8ded7' }, // coral
    { bg: '#33507a', fg: '#fbf8f1', tint: '#dbe2ec' }, // navy
    { bg: '#6e8b3d', fg: '#fbf8f1', tint: '#e7ecd8' }, // olive
    { bg: '#7b4b72', fg: '#fbf8f1', tint: '#ece0e9' }  // plum
];

function accentFor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return CARD_ACCENTS[hash % CARD_ACCENTS.length];
}

function escapeHtml(str: string) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

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

            renderGameBrowser();
        }
    );

    // Currently selected mechanic filters (OR semantics; empty = show everything).
    const activeMechanics: { [mechanic: string]: boolean } = {};

    function renderGameBrowser() {
        // Collect non-debug games that are enabled (default: enabled).
        const games = Object.keys(_mprules.MPRULES)
            .map((name) => ({ name, rule: _mprules.MPRULES[name] }))
            .filter((g) => !g.rule.debug && g.rule.enabled !== false)
            .sort((a, b) => a.name.localeCompare(b.name));

        // Tally mechanics across all games.
        const counts: { [mechanic: string]: number } = {};
        games.forEach((g) => {
            (g.rule.mechanics || []).forEach((m: string) => {
                counts[m] = (counts[m] || 0) + 1;
            });
        });
        const mechanics = Object.keys(counts).sort((a, b) => a.localeCompare(b));

        renderFilterBar(mechanics, counts, games);
        renderGrid(games);
    }

    function renderFilterBar(
        mechanics: string[],
        counts: { [mechanic: string]: number },
        games: { name: string; rule: any }[]
    ) {
        const $bar = $('#mechanic-filter').empty();

        $('<p class="filter-bar__label">Filter by mechanic</p>').appendTo($bar);
        const $chips = $('<div class="filter-bar__chips" />').appendTo($bar);

        const hasActive = Object.keys(activeMechanics).some((m) => activeMechanics[m]);

        // "All" resets every filter.
        const $all = $('<span class="chip">All games <span class="chip__count">' + games.length + '</span></span>');
        if (!hasActive) {
            $all.addClass('is-active');
        }
        $all.on('click', () => {
            Object.keys(activeMechanics).forEach((m) => delete activeMechanics[m]);
            renderGameBrowser();
        });
        $chips.append($all);

        mechanics.forEach((m) => {
            const $chip = $('<span class="chip">' + escapeHtml(m) +
                ' <span class="chip__count">' + counts[m] + '</span></span>');
            if (activeMechanics[m]) {
                $chip.addClass('is-active');
            }
            $chip.on('click', () => toggleMechanic(m));
            $chips.append($chip);
        });
    }

    function toggleMechanic(mechanic: string) {
        if (activeMechanics[mechanic]) {
            delete activeMechanics[mechanic];
        } else {
            activeMechanics[mechanic] = true;
        }
        renderGameBrowser();
    }

    function renderGrid(games: { name: string; rule: any }[]) {
        const $grid = $('#rules').empty();
        const selected = Object.keys(activeMechanics).filter((m) => activeMechanics[m]);

        const visible = games.filter((g) => {
            if (selected.length === 0) {
                return true;
            }
            const gm = g.rule.mechanics || [];
            return selected.some((m) => gm.indexOf(m) !== -1);
        });

        if (visible.length === 0) {
            $grid.append('<p class="grid-empty">No games match that combination of mechanics. Try clearing a filter.</p>');
            return;
        }

        visible.forEach((g) => $grid.append(makeCard(g.name, g.rule)));
    }

    function makeCard(name: string, rule: any) {
        const accent = accentFor(name);
        const prettyName = name.charAt(0).toUpperCase() + name.slice(1);

        const $card = $('<div class="game-card" />').on('click', hostGame(name));

        // Colored banner — title only (the icon now lives as a body watermark).
        const $banner = $('<div class="game-card__banner" />')
            .css({ 'background-color': accent.bg, color: accent.fg })
            .appendTo($card);
        $('<h3 class="game-card__title">' + escapeHtml(prettyName) + '</h3>').appendTo($banner);

        // Body tinted with the banner hue washed pale.
        const $body = $('<div class="game-card__body" />')
            .css('background-color', accent.tint)
            .appendTo($card);

        // Geometric icon (declared on the rule) imprinted large in the
        // bottom-right, bled off the corner.
        const glyph = rule.glyph;
        if (glyph) {
            const svg = iconToSvg(glyph, { primary: accent.bg, background: accent.tint });
            $('<div class="game-card__watermark" aria-hidden="true">' + svg + '</div>').appendTo($body);
        }

        $('<p class="game-card__desc">' + escapeHtml(rule.description) + '</p>').appendTo($body);

        const mechanics: string[] = rule.mechanics || [];
        if (mechanics.length) {
            const $tags = $('<div class="game-card__tags" />').appendTo($body);
            mechanics.forEach((m) => {
                const $tag = $('<span class="tag">' + escapeHtml(m) + '</span>');
                if (activeMechanics[m]) {
                    $tag.addClass('is-active');
                }
                // Tapping a tag filters instead of hosting.
                $tag.on('click', (ev) => {
                    ev.stopPropagation();
                    toggleMechanic(m);
                });
                $tags.append($tag);
            });
        }

        if (rule.minPlayers && rule.maxPlayers) {
            const playersText = rule.minPlayers === rule.maxPlayers
                ? `${rule.minPlayers} players`
                : `${rule.minPlayers}–${rule.maxPlayers} players`;
            $('<div class="game-card__players"><i class="fa fa-users"></i> ' + playersText + '</div>')
                .appendTo($body);
        }

        return $card;
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
