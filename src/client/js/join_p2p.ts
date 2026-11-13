/**
 * join_p2p.ts
 *
 * WebRTC entry point for joining players.
 */

export {};

import { getIceServersConfig } from './iceservers';

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

/**
 * The last game this browser joined, so a player who swiped "back" or closed the
 * tab can get back in with one tap. Only the room and the client id are kept: the
 * host still has the player's seat under that client id, and rejoining with it as
 * the peer id reclaims the seat.
 */
const LAST_JOIN_KEY = 'mp-last-join';
const LAST_JOIN_MAX_AGE_MS = 12 * 60 * 60 * 1000;

interface LastJoin { roomId: string; clientId: string; at: number; }

/**
 * Client id this browser used in each room it joined, so opening a bare room link
 * (`#roomId=mp-123456`, no clientId) after a reload rejoins as the same player
 * instead of taking a new seat.
 */
const JOIN_IDS_KEY = 'mp-join-ids';
const JOIN_IDS_CAPACITY = 10;
// Set (per tab) when the player chose to join as someone new, so the cached id is skipped once.
const JOIN_FRESH_KEY = 'mp-join-fresh';

type JoinIds = { [roomId: string]: { clientId: string; at: number } };

function normalizeRoomId(roomId: string) {
    return roomId.startsWith('mp-') ? roomId : 'mp-' + roomId;
}

function loadJoinIds(): JoinIds {
    try {
        const v = JSON.parse(localStorage.getItem(JOIN_IDS_KEY) || 'null');
        return v && typeof v === 'object' ? v : {};
    } catch (e) {
        return {};
    }
}

function saveLastJoin(roomId: string, clientId: string) {
    if (!roomId || !clientId) return;
    const at = Date.now();
    try {
        localStorage.setItem(LAST_JOIN_KEY, JSON.stringify({ roomId, clientId, at }));

        const ids = loadJoinIds();
        ids[normalizeRoomId(roomId)] = { clientId, at };
        const keep = Object.keys(ids)
            .sort((a, b) => ids[b].at - ids[a].at)
            .slice(0, JOIN_IDS_CAPACITY);
        const trimmed: JoinIds = {};
        keep.forEach((k) => { trimmed[k] = ids[k]; });
        localStorage.setItem(JOIN_IDS_KEY, JSON.stringify(trimmed));
    } catch (e) { /* storage blocked: resume just won't be offered */ }
}

/** The client id this browser last used in `roomId`, if it is recent enough to still hold a seat. */
function cachedClientIdFor(roomId: string): string | null {
    const fullRoomId = normalizeRoomId(roomId);
    const entry = loadJoinIds()[fullRoomId];
    if (entry && typeof entry.clientId === 'string' && Date.now() - entry.at <= LAST_JOIN_MAX_AGE_MS) {
        return entry.clientId;
    }
    const last = loadLastJoin();
    if (last && normalizeRoomId(last.roomId) === fullRoomId) {
        return last.clientId;
    }
    return null;
}

/** Offer a way out when the cached identity can't be reclaimed (e.g. it is live in another tab). */
function offerJoinAsNew(roomId: string) {
    $('<button type="button" class="join__resume-dismiss">Join as a new player instead</button>')
        .css({ display: 'block', margin: '8px auto 0' })
        .on('click', () => {
            try { sessionStorage.setItem(JOIN_FRESH_KEY, normalizeRoomId(roomId)); } catch (e) { /* ignore */ }
            history.replaceState(null, '', location.pathname + location.search + '#roomId=' + roomId);
            location.reload();
        })
        .appendTo('#error');
}

function loadLastJoin(): LastJoin | null {
    try {
        const v = JSON.parse(localStorage.getItem(LAST_JOIN_KEY) || 'null');
        if (!v || typeof v.roomId !== 'string' || typeof v.clientId !== 'string' || typeof v.at !== 'number') return null;
        if (Date.now() - v.at > LAST_JOIN_MAX_AGE_MS) return null;
        return v;
    } catch (e) {
        return null;
    }
}

function clearLastJoin() {
    try { localStorage.removeItem(LAST_JOIN_KEY); } catch (e) { /* ignore */ }
}

function timeAgo(at: number): string {
    const mins = Math.max(0, Math.round((Date.now() - at) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    const hrs = Math.round(mins / 60);
    return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
}

/** Offer the last joined game. Resuming reloads with the rejoin hash, because this
 *  page has already opened the PeerJS connection under a fresh random id. */
function showResume(last: LastJoin) {
    const $resume = $('#resume');
    const code = last.roomId.startsWith('mp-') ? last.roomId.substring(3) : last.roomId;
    $resume.find('.join__resume-code').text(code);
    $resume.find('.join__resume-when').text('Joined ' + timeAgo(last.at));
    $resume.find('.join__resume-btn').off('click').on('click', () => {
        window.location.hash = 'roomId=' + last.roomId + '&clientId=' + last.clientId;
        window.location.reload();
    });
    $resume.find('.join__resume-dismiss').off('click').on('click', () => {
        clearLastJoin();
        $resume.attr('hidden', 'hidden');
    });
    $resume.removeAttr('hidden');
}


$(() => {
    let clientId = '';
    const $joinButton = $('#join-button');

    $joinButton.hide();

    // Resolve robust WebRTC transport configurations
    const iceServers = getIceServersConfig();
    const transportOpts: any = { iceServers };

    const hash = parseHash();

    // A bare room link for a room this browser already joined: rejoin as the same
    // player rather than generating a new client id (which would take a new seat).
    let usedCachedId = false;
    if (hash.roomId && !hash.clientId) {
        let skipCache = false;
        try {
            skipCache = sessionStorage.getItem(JOIN_FRESH_KEY) === normalizeRoomId(hash.roomId);
            sessionStorage.removeItem(JOIN_FRESH_KEY);
        } catch (e) { /* ignore */ }

        const cached = skipCache ? null : cachedClientIdFor(hash.roomId);
        if (cached) {
            hash.clientId = cached;
            usedCachedId = true;
            history.replaceState(null, '', location.pathname + location.search +
                '#roomId=' + hash.roomId + '&clientId=' + cached);
        }
    }

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
                if (data && data.success === false) {
                    console.error('Connection failed:', data.message);
                    $('#error').text(data.message);
                    if (usedCachedId) offerJoinAsNew(hash.roomId);
                    // Let the player retry / edit the room manually.
                    setupJoinButton(clientId, transport, hash.clientId);
                    return;
                }

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
                            if (usedCachedId) offerJoinAsNew(hash.roomId);
                            setupJoinButton(clientId, transport, hash.clientId);
                            return;
                        }

                        // Connection successful! Hide join form
                        saveLastJoin(fullRoomId, clientId);
                        $('#join').hide();
                    }
                );
            }
        );
        watchConnectionProgress(transport);
    } else {
        if (hash.roomId) {
            const displayRoomId = hash.roomId.startsWith('mp-') ? hash.roomId.substring(3) : hash.roomId;
            $('#roomId').val(displayRoomId);
        }

        const last = loadLastJoin();
        if (last) showResume(last);

        // Standard flow: dynamic client ID generation, wait for button click
        const transport = new _mplib.WebRTCTransport(
            transportOpts,
            (data) => {
                if (data && data.success === false) {
                    console.error('Connection failed:', data.message);
                    $('#error').text(data.message);
                    $joinButton.removeAttr('disabled').text('Join Game');
                    return;
                }

                _mplib.messages.checkReturnMessage(data, 'clientId');
                clientId = data.message;
                $('#clientId').val(clientId);
                setupJoinButton(clientId, transport);
            }
        );
        watchConnectionProgress(transport);
    }
});

/**
 * Show connection attempts on the join page while the transport retries in the
 * background: one dot per attempt, the current one pulsing, failed ones in red,
 * plus a countdown to the next retry and the reason the last attempt failed.
 */
function watchConnectionProgress(transport: any) {
    if (!transport || typeof transport.onStatusChange !== 'function') return;

    const $progress = $('#join-progress');
    const $dots = $progress.find('.join__progress-dots');
    const $text = $progress.find('.join__progress-text');
    const $reason = $progress.find('.join__progress-reason');
    let latest: any = null;
    let ticker: any = null;

    const stopTicker = () => {
        if (ticker) clearInterval(ticker);
        ticker = null;
    };

    const render = () => {
        const status = latest;
        if (!status) return;

        const visible = status.phase !== 'connected' && (status.attempt > 0 || !!status.lastError);
        if (!visible) {
            $progress.attr('hidden', 'hidden');
            stopTicker();
            return;
        }
        $progress.removeAttr('hidden');
        $progress.toggleClass('is-failed', status.phase === 'failed');

        const attempt = Math.max(0, status.attempt || 0);
        const of = status.maxAttempts ? ' of ' + status.maxAttempts : '';
        const total = Math.max(status.maxAttempts || attempt, attempt);
        $dots.empty();
        for (let i = 1; i <= total; i++) {
            let cls = '';
            if (i < attempt) {
                cls = 'is-failed';
            } else if (i === attempt) {
                cls = status.phase === 'connecting' ? 'is-active' : 'is-failed';
            }
            $('<span>').addClass(cls).attr('title', 'Attempt ' + i).appendTo($dots);
        }

        let text = '';
        switch (status.phase) {
            case 'signaling':
                text = 'Waiting for the signaling server…';
                break;
            case 'connecting':
                text = 'Connecting to the host — attempt ' + attempt + of + '…';
                break;
            case 'waiting-retry': {
                const secs = status.nextRetryAt ? Math.max(0, Math.ceil((status.nextRetryAt - Date.now()) / 1000)) : 0;
                text = 'Attempt ' + attempt + of + " didn't connect. Retrying in " + secs + 's…';
                break;
            }
            case 'failed':
                text = "Couldn't connect after " + attempt + (attempt === 1 ? ' attempt.' : ' attempts.');
                break;
        }
        $text.text(text);
        $reason.text(status.lastError || '');

        if (status.phase === 'waiting-retry') {
            if (!ticker) ticker = setInterval(render, 500);
        } else {
            stopTicker();
        }
    };

    transport.onStatusChange((status: any) => {
        latest = status;
        render();
    });
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
                    saveLastJoin(roomId, rejoinId);
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
                    saveLastJoin(roomId, transport.getClientId());
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
