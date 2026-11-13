/**
 * host_p2p.ts
 *
 * WebRTC entry point for host.
 */

export {};

import { getIceServersConfig } from './iceservers';

import { iconToSvg } from '../lib/card-renderer/iconToSvg';

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');


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

const RESUME_SESSION_KEY = 'mp-resume-session';

// While a game is hosted the URL hash is a permalink to it, `#<ruleName>/<roomId>`,
// so refreshing the host page drops straight back into that game instead of the
// game browser.
function permalinkHash(ruleName: string, roomId: string) {
    return ruleName + '/' + encodeURIComponent(roomId);
}

function parsePermalink(hash: string): { ruleName: string, roomId: string } | null {
    const match = /^#?([^/]+)\/(.+)$/.exec(hash || '');
    if (!match) {
        return null;
    }
    return { ruleName: decodeURIComponent(match[1]), roomId: decodeURIComponent(match[2]) };
}

function prettyRuleName(name: string) {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function timeAgo(timestamp: number) {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    const days = Math.floor(hours / 24);
    if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
    return new Date(timestamp).toLocaleDateString();
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

    const sessionStore = _mplib.savedsessions.getSessionStore();
    let transport: any = null;

    // Resuming (from the saved-games list or a loaded .mpsave file) needs a
    // transport that reclaims the saved room's peer id, so the choice is stashed
    // here and the page reloaded rather than swapping peers mid-page.
    const resumeSessionId = sessionStorage.getItem(RESUME_SESSION_KEY);
    sessionStorage.removeItem(RESUME_SESSION_KEY);

    const permalink = resumeSessionId ? null : parsePermalink(location.hash);

    if (permalink) {
        resumeFromPermalink(permalink.ruleName, permalink.roomId);
    } else if (resumeSessionId && sessionStore) {
        sessionStore.get(resumeSessionId).then((session) => {
            if (session) {
                resumeSession(session);
            } else {
                startFresh('That saved game is no longer available.');
            }
        }).catch((err) => {
            console.error('Failed to read saved game', err);
            startFresh('Could not read the saved game.');
        });
    } else {
        startFresh();
    }

    /**
     * Page refreshed while hosting: resume the autosave for that room, or — if
     * nothing was saved yet — host the same game again under the same room id so
     * players' links keep working.
     */
    function resumeFromPermalink(ruleName: string, roomId: string) {
        if (!_mprules.MPRULES[ruleName]) {
            history.replaceState(null, '', location.pathname + location.search);
            startFresh('"' + ruleName + '" is not available in this version of Multiplayr.');
            return;
        }

        const lookup: Promise<any> = sessionStore ? sessionStore.get(roomId) : Promise.resolve(null);
        lookup.catch((err) => {
            console.error('Failed to read saved game', err);
            return null;
        }).then((session) => {
            if (session && session.ruleName === ruleName) {
                resumeSession(session);
            } else {
                hostInRoom(ruleName, roomId);
            }
        });
    }

    function hostInRoom(ruleName: string, roomId: string) {
        const displayRoomId = roomId.startsWith('mp-') ? roomId.substring(3) : roomId;
        $('#room-info').text('Starting ' + prettyRuleName(ruleName) + ' in room ' + displayRoomId + '…');
        $('#saved-games, #mechanic-filter, #rules, #actions').hide();

        transportOpts.customPeerId = roomId;
        transport = new _mplib.WebRTCTransport(
            transportOpts,
            (data) => {
                if (data && data.success === false) {
                    showResumeFailure(data.message);
                    return;
                }
                _mplib.messages.checkReturnMessage(data, 'clientId');
                clientId = data.message;

                const displayId = clientId.startsWith('mp-') ? clientId.substring(3) : clientId;
                $('#room-info')
                    .removeClass('connecting')
                    .addClass('connected')
                    .text('Host P2P is established. Room Code: ' + displayId);

                hostGame(ruleName)();
            }
        );
    }

    function resumeSession(session: any) {
        const roomId = session.roomId;
        const ruleName = session.ruleName;
        const savedClientId = session.clientId;

        if (!_mprules.MPRULES[ruleName]) {
            startFresh('This saved game (' + ruleName + ') is not available in this version of Multiplayr.');
            return;
        }

        console.log(`Attempting to resume P2P game at room ${roomId}...`);
        sessionStore.touch(session.sessionId);

        const displayRoomId = roomId.startsWith('mp-') ? roomId.substring(3) : roomId;
        $('#room-info').text('Resuming ' + prettyRuleName(ruleName) + ' in room ' + displayRoomId + '…');
        $('#saved-games, #mechanic-filter, #rules, #actions').hide();

        transportOpts.customPeerId = savedClientId;
        transport = new _mplib.WebRTCTransport(
            transportOpts,
            (data) => {
                if (data && data.success === false) {
                    showResumeFailure(data.message);
                    return;
                }
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
                location.hash = permalinkHash(ruleName, roomId);

                // Rehost the game using the saved state
                _mplib.MultiplayR.ReHost(
                    ruleName,
                    roomId,
                    savedClientId,
                    session.gameState,
                    transport,
                    document.getElementById('game-container'),
                    (res) => {
                        if (res && res.success === false) {
                            $('#game-container').hide().empty();
                            $('#host-setup-ui').show();
                            showResumeFailure(res.message);
                        }
                    }
                );
            }
        );
    }

    function showResumeFailure(message: string) {
        console.error('Resume failed:', message);
        $('#room-info')
            .removeClass('connected')
            .addClass('connecting')
            .text('Could not resume the saved game: ' + (message || 'unknown error') + ' ');
        $('<button class="saved-games__btn saved-games__btn--ghost">Back to games</button>')
            .on('click', () => {
                history.replaceState(null, '', location.pathname + location.search);
                location.reload();
            })
            .appendTo('#room-info');
    }

    function startFresh(notice?: string) {
        renderSavedGames(notice);

        // Instantiate WebRTC Transport (fresh game hosting)
        transport = new _mplib.WebRTCTransport(
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
    }

    function renderSavedGames(notice?: string) {
        const $section = $('#saved-games').empty().show();

        const $head = $('<div class="saved-games__head" />').appendTo($section);
        $('<p class="filter-bar__label">Continue a saved game</p>').appendTo($head);

        const $fileInput = $('<input type="file" accept=".mpsave,application/json" hidden />')
            .on('change', (ev) => {
                const input = ev.target as HTMLInputElement;
                const file = input.files && input.files[0];
                input.value = '';
                if (file) {
                    loadSaveFile(file);
                }
            })
            .appendTo($head);
        $('<button class="saved-games__btn saved-games__btn--ghost"><i class="fa fa-upload"></i> Load .mpsave file</button>')
            .on('click', () => $fileInput.trigger('click'))
            .appendTo($head);

        const $error = $('<p class="saved-games__error" />').appendTo($section);
        if (notice) {
            $error.text(notice);
        }

        const $list = $('<div class="saved-games__list" />').appendTo($section);

        if (!sessionStore) {
            $list.append('<p class="saved-games__empty">Saved games are unavailable in this browser.</p>');
            return;
        }

        sessionStore.list().then((sessions) => {
            $list.empty();
            if (sessions.length === 0) {
                $list.append('<p class="saved-games__empty">Games you host are saved here automatically. The last ' +
                    _mplib.savedsessions.SESSION_CAPACITY + ' are kept.</p>');
                return;
            }
            sessions.forEach((session) => $list.append(makeSavedGameCard(session, $error)));
        }).catch((err) => {
            console.error('Failed to list saved games', err);
            $list.empty().append('<p class="saved-games__empty">Could not read saved games.</p>');
        });
    }

    function makeSavedGameCard(session: any, $error: JQuery) {
        const accent = accentFor(session.ruleName);
        const available = !!_mprules.MPRULES[session.ruleName];
        const displayRoomId = session.roomId.startsWith('mp-') ? session.roomId.substring(3) : session.roomId;
        const players = session.players && session.players.length
            ? session.players.join(', ')
            : 'No players joined';

        const $card = $('<div class="saved-game" />').css('border-left-color', accent.bg);
        const $info = $('<div class="saved-game__info" />').appendTo($card);
        $('<div class="saved-game__title" />').text(prettyRuleName(session.ruleName)).appendTo($info);
        $('<div class="saved-game__meta" />')
            .text('Room ' + displayRoomId + ' · ' + timeAgo(session.updatedAt))
            .appendTo($info);
        $('<div class="saved-game__players" />').text(players).appendTo($info);

        const $actions = $('<div class="saved-game__actions" />').appendTo($card);
        const $resume = $('<button class="saved-games__btn"><i class="fa fa-play"></i> Resume</button>')
            .appendTo($actions);
        if (available) {
            $resume.on('click', () => {
                sessionStorage.setItem(RESUME_SESSION_KEY, session.sessionId);
                location.reload();
            });
        } else {
            $resume.attr('disabled', 'disabled').attr('title', 'This game is not available in this version.');
        }

        $('<button class="saved-games__icon-btn" title="Forget this saved game"><i class="fa fa-trash"></i></button>')
            .on('click', () => {
                if (!confirm('Forget the saved ' + prettyRuleName(session.ruleName) + ' game in room ' + displayRoomId + '?')) {
                    return;
                }
                sessionStore.remove(session.sessionId)
                    .then(() => renderSavedGames())
                    .catch((err) => {
                        console.error('Failed to delete saved game', err);
                        $error.text('Could not delete that saved game.');
                    });
            })
            .appendTo($actions);

        return $card;
    }

    function loadSaveFile(file: File) {
        const $error = $('#saved-games .saved-games__error').text('');
        if (!sessionStore) {
            $error.text('Saved games are unavailable in this browser.');
            return;
        }

        file.text().then((text) => {
            const session = _mplib.savedsessions.parseSaveFile(text);
            if (!_mprules.MPRULES[session.ruleName]) {
                throw new Error('This save is for "' + session.ruleName + '", which is not available in this version of Multiplayr.');
            }
            return sessionStore.save(session).then(() => {
                sessionStorage.setItem(RESUME_SESSION_KEY, session.sessionId);
                location.reload();
            });
        }).catch((err) => {
            console.error('Failed to load save file', err);
            $error.text(err && err.message ? err.message : 'Could not load that save file.');
        });
    }

    // Filters. Mechanics are OR'd together; the three groups are AND'd.
    //   activePlayers    — table size; null = any. PLAYER_MAX means "that many or more".
    //   activeComplexity — empty = any weight
    //   activeMechanics  — empty = any mechanic
    const activeMechanics: { [mechanic: string]: boolean } = {};
    const activeComplexity: { [level: string]: boolean } = {};
    let activePlayers: number | null = null;

    const PLAYER_MAX = 8;
    const COMPLEXITY_LEVELS = [
        { id: 'low', label: 'Low' },
        { id: 'medium', label: 'Medium' },
        { id: 'high', label: 'High' }
    ];

    type GameEntry = { name: string; rule: any };

    function supportsPlayers(rule: any, n: number) {
        if (!rule.minPlayers || !rule.maxPlayers) {
            return true; // unknown range — don't hide it
        }
        if (n >= PLAYER_MAX) {
            return rule.maxPlayers >= PLAYER_MAX;
        }
        return rule.minPlayers <= n && n <= rule.maxPlayers;
    }

    function selectedKeys(dict: { [k: string]: boolean }) {
        return Object.keys(dict).filter((k) => dict[k]);
    }

    function hasAnyFilter() {
        return activePlayers !== null ||
            selectedKeys(activeComplexity).length > 0 ||
            selectedKeys(activeMechanics).length > 0;
    }

    function matchesPlayers(g: GameEntry) {
        return activePlayers === null || supportsPlayers(g.rule, activePlayers);
    }

    function matchesComplexity(g: GameEntry) {
        const sel = selectedKeys(activeComplexity);
        return sel.length === 0 || sel.indexOf(g.rule.complexity) !== -1;
    }

    function matchesMechanics(g: GameEntry) {
        const sel = selectedKeys(activeMechanics);
        if (sel.length === 0) {
            return true;
        }
        const gm = g.rule.mechanics || [];
        return sel.some((m) => gm.indexOf(m) !== -1);
    }

    function renderGameBrowser() {
        // Collect non-debug games that are enabled (default: enabled).
        const games: GameEntry[] = Object.keys(_mprules.MPRULES)
            .map((name) => ({ name, rule: _mprules.MPRULES[name] }))
            .filter((g) => !g.rule.debug && g.rule.enabled !== false)
            .sort((a, b) => a.name.localeCompare(b.name));

        renderFilterBar(games);
        renderGrid(games);
    }

    function makeChip(label: string, count: number | null, active: boolean, onClick: () => void, showCount = true) {
        const $chip = $('<span class="chip" role="button" tabindex="0" />').text(label);
        if (count !== null && showCount) {
            $('<span class="chip__count" />').text(String(count)).appendTo($chip);
        }
        if (active) {
            $chip.addClass('is-active');
        } else if (count === 0) {
            $chip.addClass('is-empty');
        }
        $chip.on('click', onClick);
        $chip.on('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                onClick();
            }
        });
        return $chip;
    }

    function makeGroup($bar: JQuery, label: string) {
        const $group = $('<div class="filter-group" />').appendTo($bar);
        $('<p class="filter-bar__label" />').text(label).appendTo($group);
        return $('<div class="filter-bar__chips" />').appendTo($group);
    }

    function renderFilterBar(games: GameEntry[]) {
        const $bar = $('#mechanic-filter').empty();

        // Each group's counts honour the *other* groups' filters, so a count
        // tells you how many games that chip would leave on screen.
        const forPlayers = games.filter((g) => matchesComplexity(g) && matchesMechanics(g));
        const forComplexity = games.filter((g) => matchesPlayers(g) && matchesMechanics(g));
        const forMechanics = games.filter((g) => matchesPlayers(g) && matchesComplexity(g));

        // ----- Players -----
        const $players = makeGroup($bar, 'Players');
        $players.append(makeChip('Any', null, activePlayers === null, () => {
            activePlayers = null;
            renderGameBrowser();
        }));
        for (let n = 1; n <= PLAYER_MAX; n++) {
            const label = n === PLAYER_MAX ? PLAYER_MAX + '+' : String(n);
            const count = forPlayers.filter((g) => supportsPlayers(g.rule, n)).length;
            // A count beside a player number reads as another number ("4 4"), so the
            // chip only dims when nothing fits; the count lives in the tooltip.
            $players.append(makeChip(label, count, activePlayers === n, () => {
                activePlayers = activePlayers === n ? null : n;
                renderGameBrowser();
            }, false).addClass('chip--num').attr('title', count + (count === 1 ? ' game' : ' games')));
        }

        // ----- Complexity -----
        const $complexity = makeGroup($bar, 'Complexity');
        const noComplexity = selectedKeys(activeComplexity).length === 0;
        $complexity.append(makeChip('Any', null, noComplexity, () => {
            Object.keys(activeComplexity).forEach((k) => delete activeComplexity[k]);
            renderGameBrowser();
        }));
        COMPLEXITY_LEVELS.forEach((level) => {
            const count = forComplexity.filter((g) => g.rule.complexity === level.id).length;
            const $chip = makeChip(level.label, count, !!activeComplexity[level.id], () => {
                toggle(activeComplexity, level.id);
            });
            $chip.prepend(complexityPips(level.id));
            $complexity.append($chip);
        });

        // ----- Mechanics -----
        const counts: { [mechanic: string]: number } = {};
        games.forEach((g) => (g.rule.mechanics || []).forEach((m: string) => {
            counts[m] = 0;
        }));
        forMechanics.forEach((g) => (g.rule.mechanics || []).forEach((m: string) => {
            counts[m] += 1;
        }));
        const mechanics = Object.keys(counts).sort((a, b) => a.localeCompare(b));

        const $mechanics = makeGroup($bar, 'Mechanic');
        const noMechanic = selectedKeys(activeMechanics).length === 0;
        $mechanics.append(makeChip('Any', null, noMechanic, () => {
            Object.keys(activeMechanics).forEach((m) => delete activeMechanics[m]);
            renderGameBrowser();
        }));
        mechanics.forEach((m) => {
            $mechanics.append(makeChip(m, counts[m], !!activeMechanics[m], () => toggle(activeMechanics, m)));
        });
    }

    function toggle(dict: { [k: string]: boolean }, key: string) {
        if (dict[key]) {
            delete dict[key];
        } else {
            dict[key] = true;
        }
        renderGameBrowser();
    }

    function toggleMechanic(mechanic: string) {
        toggle(activeMechanics, mechanic);
    }

    function clearAllFilters() {
        activePlayers = null;
        Object.keys(activeComplexity).forEach((k) => delete activeComplexity[k]);
        Object.keys(activeMechanics).forEach((k) => delete activeMechanics[k]);
        renderGameBrowser();
    }

    /** Three small bars filled up to the level, like a signal meter. */
    function complexityPips(level: string) {
        const filled = level === 'high' ? 3 : level === 'medium' ? 2 : level === 'low' ? 1 : 0;
        const $pips = $('<span class="pips" aria-hidden="true" />');
        for (let i = 1; i <= 3; i++) {
            $('<span class="pips__bar" />').toggleClass('is-on', i <= filled).appendTo($pips);
        }
        return $pips;
    }

    function renderGrid(games: GameEntry[]) {
        const $grid = $('#rules').empty();
        const visible = games.filter((g) => matchesPlayers(g) && matchesComplexity(g) && matchesMechanics(g));

        const $summary = $('<div class="grid-summary" />').appendTo($grid);
        $('<span />')
            .text(visible.length === games.length
                ? 'Showing all ' + games.length + ' games'
                : 'Showing ' + visible.length + ' of ' + games.length + ' games')
            .appendTo($summary);
        if (hasAnyFilter()) {
            $('<button type="button" class="grid-summary__clear">Clear filters</button>')
                .on('click', clearAllFilters)
                .appendTo($summary);
        }

        if (visible.length === 0) {
            $grid.append('<p class="grid-empty">No games match those filters. Try clearing one.</p>');
            return;
        }

        visible.forEach((g) => $grid.append(makeCard(g.name, g.rule)));
    }

    function makeCard(name: string, rule: any) {
        const accent = accentFor(name);
        const prettyName = prettyRuleName(name);

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

        const $meta = $('<div class="game-card__players" />');
        if (rule.minPlayers && rule.maxPlayers) {
            const playersText = rule.minPlayers === rule.maxPlayers
                ? `${rule.minPlayers} players`
                : `${rule.minPlayers}–${rule.maxPlayers} players`;
            $meta.append('<span class="game-card__meta-item"><i class="fa fa-users"></i> ' + playersText + '</span>');
        }
        if (rule.complexity) {
            $('<span class="game-card__meta-item" />')
                .attr('title', 'Complexity: ' + rule.complexity)
                .append(complexityPips(rule.complexity))
                .append(document.createTextNode(' ' + prettyRuleName(rule.complexity)))
                .appendTo($meta);
        }
        if ($meta.children().length) {
            $meta.appendTo($body);
        }

        return $card;
    }

    function hostGame(ruleName: string) {
        return () => {
            // Hide host setup UI, show game container, and set hash
            $('#host-setup-ui').hide();
            $('#game-container').show().empty();
            location.hash = permalinkHash(ruleName, clientId);

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

