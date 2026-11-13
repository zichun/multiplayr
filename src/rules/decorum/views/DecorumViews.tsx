/**
 * DecorumViews.tsx — React views for Décorum.
 *
 * Presentation only: every mutation goes through an MP RPC method. Sounds and
 * entrance animations come from diffing successive props in the main page, so
 * every client hears and sees the same beats: an object set down, a wall
 * repainted, reactions popping up, the doorbell for a meeting.
 *
 * Built for a phone in portrait: status strip, the dollhouse, then your
 * conditions. Tap a room (or one of its slots) to open the change sheet; the
 * house previews the change and shows what it does to your own card before you
 * confirm. Anyone can try changes this way; only the active player confirms.
 *
 * Roommates board (3–4 players): tokens show who sleeps where; on your turn
 * "Switch rooms" stages a bedroom switch (asking whom to kick out when the
 * other bedroom is full), previewed the same way before you confirm.
 *
 * House twists: chips under the round track explain them; the change sheet
 * locks what a twist forbids (with the reason), rooms you can't touch this turn
 * are shaded, "Walk the cat" stages a cat move, and reactions follow the
 * talking twists.
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';

import {
    House, Move, RoomId, ObjType, Condition, Level, Reaction, Mood, Board, Beds, Ctx, Switch,
    COLORS, STYLES, TYPES, ROOMS, TYPE_NAME, OBJECT_COLOR, LEVELS, LEVEL_NAME, LEVEL_STARS, MOODS,
    REACTIONS, REACTION_LABEL, MIN_PLAYERS, MAX_PLAYERS, POINTS_PER_CONDITION, POINTS_PER_HEART,
    applyMove, moveError, evaluate, describeMove, objectLabel, conditionsPerSeat, parseScenarioCode, reactionLine, moodNeedsTarget, moodText,
    segmentsFor, heartsFor, boardFor, roomName, isRoommateCond, switchOptions, switchError, applySwitch, describeSwitch, otherBedroom,
    twistError, roomBlocked, describeTwists, ADJACENT, RuleOpts
} from '../DecorumData';
import { Phase, LogEntry } from '../DecorumGameState';
import { DCViewProps, DCPublic, DCPrivate, DCPlayer, DCLobbyInfo } from '../DecorumTypes';
import { sfx } from '../DecorumSound';
import {
    HouseView, ObjectArt, WallSwatch, Heart, ReactionFace, Wordmark, TypeGlyph, StyleGlyph, ColorDot, EmptyGlyph, SlotRef, BedGlyph, TokenP,
    CatGlyph, LockGlyph, TwistGlyph
} from './DecorumArt';
import { ConditionText, Check, Avatar, PlayerIcon, MuteToggle, Sheet, Modal, Confetti, fresh, DCText, DCTextInfo } from './DecorumBits';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const playerOf = (dc: DCPublic, id: string | null): DCPlayer | undefined => dc.players.find(p => p.id === id);
const nameOf = (dc: DCPublic, id: string | null, me?: string) =>
    id && id === me ? 'You' : ((id && playerOf(dc, id)?.name) || 'Someone');
const meetingName = (players: number) => players === 2 ? 'Heart-to-Heart' : 'House Meeting';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const Stars: React.FC<{ n: number; of?: number }> = ({ n, of = 4 }) => (
    <span className="dc-stars" aria-label={`${n} of ${of} stars`}>
        {Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
    </span>
);

/** A staged action: a change to the house, or (roommates board) a bedroom switch. */
type Pending = Move | Switch;
const isSwitch = (a: Pending | null | undefined): a is Switch => !!a && a.kind === 'switch';

const seatOfId = (dc: DCPublic, id: string | null) => { const p = playerOf(dc, id); return p ? p.seat : -1; };
const playerAtSeat = (dc: DCPublic, seat: number) => dc.players.find(p => p.seat === seat);

/** What `ownerId`'s conditions are judged against (their seat and where everyone sleeps). */
const ctxFor = (dc: DCPublic, ownerId: string | null, beds: Beds | null = dc.beds): Ctx | null =>
    beds && ownerId ? { beds, seat: seatOfId(dc, ownerId) } : null;

const seatNamer = (dc: DCPublic, me: string) => (seat: number) => {
    const p = playerAtSeat(dc, seat);
    return p ? (p.id === me ? 'you' : p.name) : `player ${seat + 1}`;
};

/** How to draw each seat's roommate token. */
const tokenPeople = (dc: DCPublic, me: string) => (seat: number): TokenP | null => {
    const p = playerAtSeat(dc, seat);
    return p ? { name: p.name, accent: p.accent, icon: p.icon, me: p.id === me } : null;
};

/** How twist messages name rooms and people for `me`. */
const ruleOpts = (dc: DCPublic, me: string): RuleOpts => ({ board: dc.board, seatName: seatNamer(dc, me) });

/** A logged action in words, from `me`'s point of view (without the actor's name). */
function actionText(dc: DCPublic, e: LogEntry, me: string): string {
    if (e.kind === 'switch' && e.sw && e.bedsBefore) return describeSwitch(e.bedsBefore, e.sw, seatNamer(dc, me), dc.board);
    if (e.move && e.before) return describeMove(e.before, e.move, dc.board);
    return e.text;
}

/** Latest move/switch/pass entry (what reactions attach to), unless a meeting came after. */
function lastAction(log: LogEntry[]): LogEntry | null {
    for (let i = log.length - 1; i >= 0; i--) {
        if (log[i].kind === 'move' || log[i].kind === 'switch' || log[i].kind === 'pass') return log[i];
        if (log[i].kind === 'meeting') return null;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const RulesView: React.FC = () => (
    <div className="dc-root dc-rules">
        <Wordmark size={30} />
        <p className="dc-lede">A cooperative game of compromise. You share a house, and everyone secretly wants it decorated
            differently. Make one change a turn, react to each other&rsquo;s changes, and find a home that makes
            <b> everyone</b> happy &mdash; without saying what you want.</p>
        <section>
            <h3>The house</h3>
            <p>Four rooms: <b>bathroom</b> and <b>bedroom</b> upstairs, <b>living room</b> and <b>kitchen</b> downstairs.
                The left side is the bathroom and living room; the right side is the bedroom and kitchen.</p>
            <p>Every room has a <b>wall color</b> and three object slots: a <b>wall hanging</b>, a <b>lamp</b> and a <b>curio</b>.
                Objects come in four styles; each style of each object has a fixed color:</p>
            <div className="dc-objtable">
                <div className="row head"><span /> {STYLES.map(s => <span key={s}><StyleGlyph style={s} size={14} /> {s}</span>)}</div>
                {TYPES.map(t => (
                    <div key={t} className="row">
                        <span className="lbl"><TypeGlyph type={t} size={16} /> {TYPE_NAME[t]}</span>
                        {STYLES.map(s => <span key={s}><ObjectArt type={t} style={s} size={38} /><small>{OBJECT_COLOR[t][s]}</small></span>)}
                    </div>
                ))}
            </div>
            <p className="dc-muted"><b>Warm</b> colors are red and yellow; <b>cool</b> colors are blue and green. A <b>feature</b> is an object or a wall color.</p>
        </section>
        <section>
            <h3>Your turn</h3>
            <ol>
                <li><b>Make one change:</b> add an object to an empty slot, remove one, swap an object for another of the same type
                    (in the same slot), or paint a room. You may <b>pass</b> only if all your conditions are met.</li>
                <li><b>Fulfillment check:</b> the game updates your &ldquo;fulfilled&rdquo; badge.</li>
                <li><b>Comment:</b> the others react with a <i>positive</i>, <i>neutral</i> or <i>negative</i> face. That&rsquo;s the only talking
                    allowed! With 2 players your partner must react before their own turn.</li>
            </ol>
            <p className="dc-muted">Tap any room to try a change: the house previews it and your card shows what it would do.
                Only the active player can confirm.</p>
        </section>
        <section>
            <h3>Roommates (3&ndash;4 players)</h3>
            <p>With 3 or 4 players, both upstairs rooms are <b>bedrooms</b> (the <b>left bedroom</b> and the <b>right bedroom</b>).
                Everyone sleeps in one of them &mdash; your token shows where &mdash; and a bedroom holds at most two people.</p>
            <p><b>Switch rooms:</b> instead of decorating, spend your turn moving to the other bedroom. If it is full, you
                pick one of its two roommates to kick out; they move into the bedroom you left.</p>
            <p>Some conditions follow you around: &ldquo;Your bedroom must&hellip;&rdquo;, &ldquo;The other bedroom&hellip;&rdquo;,
                &ldquo;You must (not) share a bedroom with&hellip;&rdquo;. Moving people can fix &mdash; or wreck &mdash; a whole card
                without touching any furniture.</p>
        </section>
        <section>
            <h3>House twists</h3>
            <p>Most scenarios come with one or more <b>twists</b> &mdash; house rules shown as chips above the house.
                Tap a chip for details. Harder levels draw more of them; the host can switch them off in the lobby.</p>
            <dl className="dc-gloss">
                <dt><TwistGlyph id="cat" /> House cat</dt><dd>Instead of decorating, walk the cat to a neighbouring room (not
                    diagonally). Some conditions care where it is or what its room holds. It may refuse rooms painted one color.</dd>
                <dt><TwistGlyph id="heirloom" /> Family heirloom</dt><dd>One object can never be removed or swapped.</dd>
                <dt><TwistGlyph id="keeper" /> Someone&rsquo;s room</dt><dd>Only that housemate may change anything in that room.</dd>
                <dt><TwistGlyph id="shortage" /> Shortage</dt><dd>Never more than a few objects of one style in the house.</dd>
                <dt><TwistGlyph id="soldOut" /> Paint sold out</dt><dd>Nobody can paint a room that color.</dd>
                <dt><TwistGlyph id="noRepeat" /> Restless</dt><dd>You can&rsquo;t change the same room on two of your turns in a row.</dd>
                <dt><TwistGlyph id="wetPaint" /> Wet paint</dt><dd>You can&rsquo;t change the room the previous player just changed.</dd>
                <dt><TwistGlyph id="binary" /> Strong opinions</dt><dd>No neutral face: react positively or negatively.</dd>
                <dt><TwistGlyph id="whisper" /> Whispers</dt><dd>Reactions are private: only the player who made the change sees them.</dd>
            </dl>
            <p className="dc-muted">Walking the cat doesn&rsquo;t count as changing a room. Twisted scenarios are still always solvable.</p>
        </section>
        <section>
            <h3>Meetings &amp; hearts</h3>
            <p><b>2 players:</b> after round 15, then every 5 rounds, you hold a <b>Heart-to-Heart</b>: each of you reveals one
                condition to the other. <b>3&ndash;4 players:</b> every 5 rounds there is a <b>House Meeting</b>: everyone says how
                they feel, then shares one condition with one housemate of their choice.</p>
            <p>Each meeting flips a heart. When the last stretch ends with no hearts left, the game is over. Before the first
                meeting, everyone may agree to hold it early.</p>
        </section>
        <section>
            <h3>Winning &amp; scoring</h3>
            <p>You all win the moment everyone is fulfilled. Score {POINTS_PER_CONDITION} points per condition met; if they all are,
                add {POINTS_PER_HEART} points for every heart still face up.</p>
        </section>
        <section>
            <h3>Glossary</h3>
            <dl className="dc-gloss">
                <dt>Inseparable</dt><dd>In every room, if one of the two is there the other must be too (either both or neither).</dd>
                <dt>Most common</dt><dd>Appears strictly more often than any other color (or style). Colors count objects and walls.</dd>
                <dt>Identical</dt><dd>Same type and style (and so the same color).</dd>
                <dt>Matching its wall</dt><dd>An object the same color as the room&rsquo;s walls.</dd>
            </dl>
        </section>
        <section>
            <h3>Scenarios</h3>
            <p>Every game is a freshly generated scenario. Each player&rsquo;s conditions are guaranteed to be satisfiable together
                &mdash; there is always at least one house that pleases everyone. Harder levels add more conditions, trickier
                kinds, more tension between housemates and a messier starting house. Share the <b>scenario code</b> to replay one.</p>
        </section>
    </div>
);

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

const LEVEL_BLURB: Record<Level, string> = {
    easy: 'Simple wants, a tidy house to start.',
    medium: 'Colors, styles and counts; some friction.',
    hard: 'Comparisons and majorities; housemates pull apart.',
    expert: 'Inseparables, no twins, lots of tension.'
};

const LobbyBody: React.FC<{ mp: any; lobby?: DCLobbyInfo; host: boolean }> = ({ mp, lobby, host }) => {
    const n = lobby ? lobby.players.length : (typeof mp.playersCount === 'function' ? mp.playersCount() + 1 : 0);
    const ok = n >= MIN_PLAYERS && n <= MAX_PLAYERS;
    const level = lobby ? lobby.level : 'easy';
    const [code, setCode] = React.useState(lobby ? lobby.code : '');
    React.useEffect(() => { if (lobby) setCode(lobby.code); }, [lobby && lobby.code]);
    const parsed = parseScenarioCode(code);
    const codeNote = !code ? null
        : !parsed ? 'Not a valid code (e.g. 3H-1A2B3C).'
            : parsed.players !== n ? `That code is for ${parsed.players} players — it will be ignored.`
                : `Replaying ${LEVEL_NAME[parsed.level]} scenario ${code.toUpperCase()}${parsed.twists ? '' : ' (no twists)'}.`;
    const per = ok ? conditionsPerSeat(n, level) : [];
    return (
        <div className="dc-root dc-lobby">
            <Wordmark size={34} />
            <p className="dc-muted center">Decorate a home together. Everyone wants something different.</p>
            {mp.getPluginView('lobby', 'SetNameWithLobby')}
            {lobby && (
                <div className="dc-lobby-people">
                    {lobby.players.map((p, i) => (
                        <span key={p.id} className="dc-lobby-p" style={{ '--d': `${i * 70}ms` } as any}>
                            <Avatar p={p} size={34} />
                            <span>{p.id === mp.clientId ? 'You' : p.name}</span>
                        </span>
                    ))}
                </div>
            )}
            {!ok && <p className="dc-warn center">{n} player{n === 1 ? '' : 's'} here. Décorum needs {MIN_PLAYERS} to {MAX_PLAYERS}.</p>}
            <div className="dc-panel">
                <div className="dc-panel-title">Difficulty</div>
                <div className="dc-levels">
                    {LEVELS.map(l => (
                        <button key={l} className={['dc-level', l === level ? 'on' : ''].join(' ')} disabled={!host}
                            onClick={() => { sfx.select(); mp.setOption('level', l); }}>
                            <b>{LEVEL_NAME[l]}</b>
                            <Stars n={LEVEL_STARS[l]} />
                            <small>{LEVEL_BLURB[l]}</small>
                        </button>
                    ))}
                </div>
                {ok && <p className="dc-muted small center">{n} players · {per.join(' / ')} conditions each · {heartsFor(n)} hearts · up to {segmentsFor(n).reduce((a, b) => a + b, 0)} rounds</p>}
                {ok && boardFor(n) === 'roommates' && <p className="dc-muted small center"><BedGlyph size={14} /> Roommates board: two bedrooms upstairs, and you can switch rooms on your turn.</p>}
                <div className="dc-twist-toggle">
                    <span><CatGlyph size={18} /> <b>House twists</b> <span className="dc-muted small">a pet, locks, turn rules… (more on harder levels)</span></span>
                    <button className={['dc-switch', lobby && lobby.twists ? 'on' : ''].join(' ')} role="switch" aria-checked={!!(lobby && lobby.twists)}
                        aria-label="House twists" disabled={!host} onClick={() => { sfx.select(); mp.setOption('twists', !(lobby && lobby.twists)); }}>
                        <i />
                    </button>
                </div>
                {host
                    ? <div className="dc-code">
                        <label>Scenario code <span className="dc-muted">(optional, to replay)</span></label>
                        <div className="dc-code-row">
                            <input value={code} placeholder="e.g. 3H-1A2B3C" maxLength={12}
                                onChange={e => setCode(e.target.value.toUpperCase())}
                                onBlur={() => mp.setOption('code', code)} />
                            {code && <button className="dc-btn ghost small" onClick={() => { setCode(''); mp.setOption('code', ''); }}>Clear</button>}
                        </div>
                        {codeNote && <span className={['small', parsed && parsed.players === n ? 'dc-ok' : 'dc-warn'].join(' ')}>{codeNote}</span>}
                    </div>
                    : lobby && lobby.code ? <p className="dc-muted small center">Scenario code: <b>{lobby.code}</b></p> : null}
            </div>
            {!host && <div className="dc-waiting">Waiting for the host to start…</div>}
        </div>
    );
};

export class DCHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const lobby: DCLobbyInfo | undefined = (this.props as any).dcLobby;
        const links: any = {
            'home': { 'icon': 'home', 'label': 'Lobby', 'view': <LobbyBody mp={mp} lobby={lobby} host /> },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Décorum', 'links': links });
    }
}

export class DCClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const lobby: DCLobbyInfo | undefined = (this.props as any).dcLobby;
        const links: any = {
            'home': { 'icon': 'home', 'label': 'Lobby', 'view': <LobbyBody mp={mp} lobby={lobby} host={false} /> },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Décorum', 'links': links });
    }
}

// ---------------------------------------------------------------------------
// Status strip: round track + hearts + whose turn
// ---------------------------------------------------------------------------

const RoundTrack: React.FC<{ dc: DCPublic }> = ({ dc }) => {
    const len = dc.segments[dc.segment] || 0;
    const last = dc.segment >= dc.segments.length - 1;
    const pct = Math.min(1, (dc.round - 1) / Math.max(1, len - 1));
    return (
        <div className="dc-track">
            <div className="dc-track-top">
                <span className="dc-round">Round <b>{dc.round}</b><span className="dc-muted">/{len}</span></span>
                <span className="dc-muted small">{last ? 'Final stretch' : `${meetingName(dc.players.length)} after round ${len}`}</span>
                <span className="dc-hearts">
                    {Array.from({ length: dc.totalHearts }, (_, i) => <Heart key={i} up={i < dc.hearts} size={18} />)}
                </span>
            </div>
            <div className="dc-track-bar"><i style={{ width: `${pct * 100}%` }} /></div>
        </div>
    );
};

/** The scenario's house twists as chips; tap one for its rule. */
const TwistBar: React.FC<{ dc: DCPublic; my: DCPrivate }> = ({ dc, my }) => {
    const [open, setOpen] = React.useState<string | null>(null);
    const info = describeTwists(dc.twists, ruleOpts(dc, my.me));
    if (!info.length) return null;
    const cur = info.find(t => t.id === open);
    return (
        <div className="dc-twists">
            <div className="dc-twist-chips">
                {info.map(t => (
                    <button key={t.id} className={['dc-twist-chip', open === t.id ? 'on' : ''].join(' ')} onClick={() => { sfx.tap(); setOpen(open === t.id ? null : t.id); }}>
                        <TwistGlyph id={t.id} size={15} /> {t.title}
                    </button>
                ))}
            </div>
            {cur && <div className="dc-twist-text">{cur.text}</div>}
        </div>
    );
};

const PlayerStrip: React.FC<{ dc: DCPublic; my: DCPrivate }> = ({ dc, my }) => (
    <div className="dc-people">
        {dc.players.map(p => (
            <div key={p.id} className={['dc-person', dc.activeId === p.id ? 'active' : '', p.id === my.me ? 'me' : ''].join(' ')} style={{ '--a': p.accent } as any}>
                <span className="dc-person-av">
                    <Avatar p={p} size={30} />
                    {p.declared && <span className="dc-fulfilled" title="Fulfilled"><svg viewBox="0 0 24 24" width="10" height="10"><path d="M4 12.5 L9.5 18 L20 6.5 L17.6 4.6 L9.4 13.6 L6.3 10.4 Z" fill="#fff" /></svg></span>}
                </span>
                <span className="dc-person-name">{p.id === my.me ? 'You' : p.name}</span>
                {dc.phase === Phase.Meeting && <span className={['dc-person-tag', p.meetingDone ? 'ok' : ''].join(' ')}>{p.meetingDone ? 'shared' : '…'}</span>}
            </div>
        ))}
    </div>
);

// ---------------------------------------------------------------------------
// The change sheet
// ---------------------------------------------------------------------------

const RoomSheet: React.FC<{
    house: House; room: RoomId; focus: ObjType | 'wall'; board: Board;
    /** Why a twist forbids this change (null = allowed). */
    why: (m: Move) => string | null;
    /** The whole room is off limits for you right now (keeper / turn rules). */
    blocked: string | null;
    onMove: (m: Move) => void; onClose: () => void; onRoom: (r: RoomId) => void;
}> = ({ house, room, focus, board, why, blocked, onMove, onClose, onRoom }) => {
    const r = house[room];
    /** One option button; locked (with the reason) when a twist forbids it. */
    const opt = (key: string, m: Move, isCur: boolean, art: React.ReactNode, label: string, title: string, extra = '') => {
        const reason = isCur ? null : why(m);
        return (
            <button key={key} className={['dc-opt', extra, isCur ? 'cur' : '', reason ? 'locked' : ''].join(' ')} disabled={isCur || !!reason}
                title={reason || title} onClick={() => onMove(m)}>
                {art}
                <small>{label}</small>
                {reason && <span className="dc-opt-lock"><LockGlyph size={12} fill="#8f8aa6" /></span>}
            </button>
        );
    };
    const row = (t: ObjType) => {
        const cur = r[t];
        const notes = Array.from(new Set(
            STYLES.map(s => s === cur ? null : why(cur ? { kind: 'swap', room, type: t, style: s } : { kind: 'add', room, type: t, style: s }))
                .concat(cur ? [why({ kind: 'remove', room, type: t })] : [])
                .filter((x): x is string => !!x && x !== blocked)));
        return (
            <div key={t} className={['dc-sheet-row', focus === t ? 'focus' : ''].join(' ')}>
                <div className="dc-sheet-lbl"><TypeGlyph type={t} size={16} /> {cap(TYPE_NAME[t])}</div>
                <div className="dc-opts">
                    {STYLES.map(s => opt(s, cur ? { kind: 'swap', room, type: t, style: s } : { kind: 'add', room, type: t, style: s },
                        cur === s, <ObjectArt type={t} style={s} size={40} />, s, objectLabel(t, s)))}
                    {cur
                        ? opt('remove', { kind: 'remove', room, type: t }, false, <EmptyGlyph size={30} />, 'remove', 'Remove', 'remove')
                        : <button className="dc-opt remove" disabled title="Remove"><EmptyGlyph size={30} /><small>remove</small></button>}
                </div>
                {notes.map(n => <div key={n} className="dc-sheet-note"><LockGlyph size={12} fill="#8f8aa6" /> {n}.</div>)}
            </div>
        );
    };
    const wallNotes = Array.from(new Set(COLORS.filter(c => c !== r.wall).map(c => why({ kind: 'paint', room, color: c }))
        .filter((x): x is string => !!x && x !== blocked)));
    return (
        <Sheet onClose={onClose}>
            <div className="dc-sheet-head">
                <div className="dc-room-tabs">
                    {ROOMS.map(x => <button key={x} className={x === room ? 'on' : ''} onClick={() => onRoom(x)}>{cap(roomName(x, board))}</button>)}
                </div>
                <button className="dc-modal-x" onClick={onClose} aria-label="Close">×</button>
            </div>
            {blocked && <div className="dc-sheet-blocked"><LockGlyph size={14} fill="#c06a64" /> {blocked}.</div>}
            <div className={['dc-sheet-row', focus === 'wall' ? 'focus' : ''].join(' ')}>
                <div className="dc-sheet-lbl"><ColorDot color={r.wall} wall size={16} /> Walls</div>
                <div className="dc-opts">
                    {COLORS.map(c => opt(c, { kind: 'paint', room, color: c }, r.wall === c, <WallSwatch color={c} size={40} />, c, `${c} paint`))}
                </div>
                {wallNotes.map(n => <div key={n} className="dc-sheet-note"><LockGlyph size={12} fill="#8f8aa6" /> {n}.</div>)}
            </div>
            {TYPES.map(row)}
        </Sheet>
    );
};

/**
 * A condition someone else owns: "Ada: The kitchen must…", or for conditions
 * relative to their owner just "Ada's bedroom must…" / "Ada must share…".
 */
const KnownText: React.FC<{ cond: Condition; who?: string }> = ({ cond, who }) => {
    if (!who) return <ConditionText cond={cond} />;
    if (isRoommateCond(cond)) return <ConditionText cond={cond} owner={who} />;
    return <><b className="dc-who">{who}: </b><ConditionText cond={cond} /></>;
};

/** A house plus who sleeps where (beds null on the classic board). */
interface View { house: House; beds: Beds | null; }

/** What a pending action does to my own (and known) conditions. */
const MoveEffects: React.FC<{ dc: DCPublic; me: string; before: View; after: View; card: Condition[]; known: { cond: Condition; who: string; from: string }[] }> = ({ dc, me, before, after, card, known }) => {
    const rows: { cond: Condition; was: boolean; now: boolean; who?: string }[] = [];
    const mine = (v: View) => ctxFor(dc, me, v.beds);
    card.forEach(c => rows.push({ cond: c, was: evaluate(c, before.house, mine(before)), now: evaluate(c, after.house, mine(after)) }));
    known.forEach(k => rows.push({
        cond: k.cond, who: k.who,
        was: evaluate(k.cond, before.house, ctxFor(dc, k.from, before.beds)), now: evaluate(k.cond, after.house, ctxFor(dc, k.from, after.beds))
    }));
    const changes = rows.filter(r => r.was !== r.now);
    const metNow = card.filter(c => evaluate(c, after.house, mine(after))).length;
    return (
        <div className="dc-effects">
            {card.length > 0 && <div className="dc-effects-sum">Your card: <b>{metNow}/{card.length}</b> met{metNow === card.length ? ' — fulfilled!' : ''}</div>}
            {changes.length === 0
                ? <div className="dc-muted small">No change to {card.length ? 'your' : 'any known'} conditions.</div>
                : changes.map((r, i) => (
                    <div key={i} className={['dc-effect', r.now ? 'up' : 'down'].join(' ')}>
                        <Check ok={r.now} size={20} />
                        <span><KnownText cond={r.cond} who={r.who} /></span>
                    </div>
                ))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Conditions panel
// ---------------------------------------------------------------------------

const CardPanel: React.FC<{ dc: DCPublic; my: DCPrivate; house: House; beds: Beds | null }> = ({ dc, my, house, beds }) => {
    const met = my.card.map(c => evaluate(c, house, ctxFor(dc, my.me, beds)));
    const all = met.length > 0 && met.every(Boolean);
    const sharedTo = (idx: number) => my.given.filter(g => g.idx === idx).map(g => nameOf(dc, g.to));
    return (
        <div className="dc-panel dc-card">
            <div className="dc-panel-title">
                <span>Your conditions</span>
                <span className={['dc-pill', all ? 'ok' : ''].join(' ')}>{met.filter(Boolean).length}/{met.length}{all ? ' · fulfilled' : ''}</span>
            </div>
            {my.card.map((c, i) => (
                <div key={i} className={['dc-cond', met[i] ? 'met' : ''].join(' ')}>
                    <Check ok={met[i]} />
                    <div>
                        <ConditionText cond={c} />
                        {sharedTo(i).length > 0 && <div className="dc-shared-note">Shared with {sharedTo(i).join(', ')}</div>}
                    </div>
                </div>
            ))}
            {my.known.length > 0 && (
                <>
                    <div className="dc-panel-sub">Shared with you</div>
                    {my.known.map((k, i) => {
                        const p = playerOf(dc, k.from);
                        const ok = evaluate(k.cond, house, ctxFor(dc, k.from, beds));
                        return (
                            <div key={i} className={['dc-cond known', ok ? 'met' : ''].join(' ')} style={{ '--a': p ? p.accent : '#999' } as any}>
                                <Check ok={ok} />
                                <div><KnownText cond={k.cond} who={nameOf(dc, k.from)} /></div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Last change + reactions
// ---------------------------------------------------------------------------

const MoveIcon: React.FC<{ e: LogEntry }> = ({ e }) => {
    if (e.kind === 'switch') return <span className="dc-move-ic switch"><BedGlyph size={30} /></span>;
    const m = e.move;
    if (!m) return <span className="dc-move-ic pass">—</span>;
    if (m.kind === 'cat') return <span className="dc-move-ic cat"><CatGlyph size={30} /></span>;
    if (m.kind === 'paint') return <span className="dc-move-ic"><WallSwatch color={m.color} size={34} /></span>;
    if (m.kind === 'remove') {
        const s = e.before ? e.before[m.room][m.type] : null;
        return <span className="dc-move-ic out">{s ? <ObjectArt type={m.type} style={s} size={34} /> : <EmptyGlyph size={28} />}</span>;
    }
    return <span className="dc-move-ic"><ObjectArt type={m.type} style={m.style} size={34} /></span>;
};

const Reactions: React.FC<{ dc: DCPublic; e: LogEntry; me: string }> = ({ dc, e, me }) => {
    const ids = Object.keys(e.reactions);
    if (!ids.length) return null;
    return (
        <div className="dc-reactions">
            {dc.players.filter(p => e.reactions[p.id]).map(p => {
                const kind = e.reactions[p.id];
                return (
                    <span key={p.id} className={['dc-bubble', `k-${kind}`, fresh(me, `r-${e.id}-${p.id}`) ? 'pop' : ''].join(' ')}>
                        <ReactionFace kind={kind} size={22} />
                        <span><b>{p.id === me ? 'You' : p.name}:</b> {reactionLine(kind, e.id * 7 + p.seat)}</span>
                    </span>
                );
            })}
        </div>
    );
};

const LastChange: React.FC<{ dc: DCPublic; my: DCPrivate; onReact: (k: Reaction) => void }> = ({ dc, my, onReact }) => {
    const e = lastAction(dc.log);
    if (!e) return null;
    const by = playerOf(dc, e.by);
    const waiting = dc.players.filter(p => p.id !== e.by && !e.reactions[p.id]);
    const faces = dc.twists && dc.twists.binary ? REACTIONS.filter(k => k !== 'meh') : REACTIONS;
    const whisper = !!(dc.twists && dc.twists.whisper);
    return (
        <div className={['dc-panel dc-last', my.owesReaction ? 'needs' : ''].join(' ')} style={{ '--a': by ? by.accent : '#999' } as any}>
            <div className="dc-last-row">
                <MoveIcon e={e} />
                <div className="dc-last-text"><b>{nameOf(dc, e.by, my.me)}</b> {actionText(dc, e, my.me)}.</div>
            </div>
            <Reactions dc={dc} e={e} me={my.me} />
            {whisper && e.kind !== 'pass' && (
                <div className="dc-muted small dc-whisper">{e.by === my.me ? 'Whispers: only you see the reactions to your change.' : `Whispers: only ${by ? by.name : 'they'} will see your reaction.`}</div>
            )}
            {my.canReact && (
                <div className="dc-react-row">
                    <span className="dc-muted small">{my.owesReaction ? 'React before your turn:' : 'Your reaction:'}</span>
                    {faces.map(k => (
                        <button key={k} className={`dc-react k-${k}`} onClick={() => onReact(k)} aria-label={REACTION_LABEL[k]}>
                            <ReactionFace kind={k} size={34} />
                            <small>{REACTION_LABEL[k]}</small>
                        </button>
                    ))}
                </div>
            )}
            {!my.canReact && waiting.length > 0 && dc.phase === Phase.Play && dc.players.length === 2 && (
                <div className="dc-muted small">Waiting for {waiting.map(p => p.id === my.me ? 'you' : p.name).join(', ')} to react…</div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

const MeetingPanel: React.FC<{ dc: DCPublic; my: DCPrivate; mp: any }> = ({ dc, my, mp }) => {
    const m = dc.meeting!;
    const two = m.kind === 'h2h';
    const others = dc.players.filter(p => p.id !== my.me);
    const [mood, setMood] = React.useState<Mood | null>(null);
    const [moodTarget, setMoodTarget] = React.useState<string | null>(null);
    const [to, setTo] = React.useState<string | null>(two ? (others[0] ? others[0].id : null) : null);
    const [cond, setCond] = React.useState<number | null>(null);
    const mine = my.myMeeting;
    const shared = !!(mine && (mine.share || mine.skipped));
    const moodDone = two || !!(mine && mine.mood);
    const options = my.shareOptions;
    const canShare = (i: number) => !!to && options.some(o => o.cond === i && o.to === to);
    const fromThisMeeting = my.known.filter(k => k.meeting === m.idx);

    return (
        <div className="dc-meeting">
            <div className="dc-meeting-head">
                <Heart up size={34} className="beat" />
                <div>
                    <h2>{two ? 'Heart-to-Heart' : 'House Meeting'}</h2>
                    <div className="dc-muted small">{m.early ? 'Called early. ' : ''}A heart flips when everyone has shared.</div>
                </div>
            </div>

            {!two && (
                <div className="dc-meeting-moods">
                    {m.moods.map(x => (
                        <div key={x.by} className="dc-mood-line">
                            <Avatar p={playerOf(dc, x.by)!} size={22} />
                            <span><b>{nameOf(dc, x.by, my.me)}:</b> &ldquo;{moodText(x.mood, nameOf(dc, x.target, my.me))}.&rdquo;</span>
                        </div>
                    ))}
                </div>
            )}

            {fromThisMeeting.map((k, i) => (
                <div key={i} className="dc-revealed">
                    <div className="dc-muted small"><b>{nameOf(dc, k.from)}</b> shared with you:</div>
                    <ConditionText cond={k.cond} owner={nameOf(dc, k.from)} />
                </div>
            ))}

            {my.isPlayer && !moodDone && (
                <div className="dc-panel">
                    <div className="dc-panel-title">How do you feel about the house?</div>
                    <div className="dc-moods">
                        {MOODS.map(x => (
                            <button key={x} className={['dc-chip', mood === x ? 'on' : ''].join(' ')} onClick={() => { sfx.tap(); setMood(x); }}>
                                {moodText(x)}
                            </button>
                        ))}
                    </div>
                    {mood && moodNeedsTarget(mood) && (
                        <div className="dc-who-pick">
                            {others.map(p => (
                                <button key={p.id} className={['dc-chip', moodTarget === p.id ? 'on' : ''].join(' ')} onClick={() => setMoodTarget(p.id)}>
                                    <Avatar p={p} size={20} /> {p.name}
                                </button>
                            ))}
                        </div>
                    )}
                    <button className="dc-btn primary" disabled={!mood || (moodNeedsTarget(mood) && !moodTarget)}
                        onClick={() => { sfx.select(); mp.mood(mood, moodTarget); }}>Say it</button>
                </div>
            )}

            {my.isPlayer && moodDone && !shared && (
                <div className="dc-panel">
                    <div className="dc-panel-title">{two ? 'Share one condition with your partner' : 'Share one condition'}</div>
                    {!two && (
                        <div className="dc-who-pick">
                            <span className="dc-muted small">With:</span>
                            {others.map(p => (
                                <button key={p.id} className={['dc-chip', to === p.id ? 'on' : ''].join(' ')} onClick={() => { sfx.tap(); setTo(p.id); setCond(null); }}>
                                    <Avatar p={p} size={20} /> {p.name}
                                </button>
                            ))}
                        </div>
                    )}
                    {options.length === 0
                        ? <>
                            <p className="dc-muted">You have already shared everything you can.</p>
                            <button className="dc-btn primary" onClick={() => mp.share(null)}>Continue</button>
                        </>
                        : <>
                            {my.card.map((c, i) => {
                                const ok = canShare(i);
                                return (
                                    <button key={i} className={['dc-share-opt', cond === i ? 'on' : ''].join(' ')} disabled={!ok}
                                        onClick={() => { sfx.tap(); setCond(i); }}>
                                        <ConditionText cond={c} />
                                        {!ok && to && <small className="dc-muted"> (already shared with them)</small>}
                                    </button>
                                );
                            })}
                            <button className="dc-btn primary" disabled={cond === null || !to || !canShare(cond)}
                                onClick={() => { sfx.share(); mp.share(cond, to); setCond(null); }}>Share</button>
                        </>}
                </div>
            )}

            {(!my.isPlayer || (shared && moodDone)) && (
                <div className="dc-muted center">Waiting for {dc.players.filter(p => !p.meetingDone).map(p => p.id === my.me ? 'you' : p.name).join(', ') || 'everyone'}…</div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const Results: React.FC<{ dc: DCPublic; my: DCPrivate; mp: any }> = ({ dc, my, mp }) => {
    const r = dc.result!;
    const [showSolution, setShowSolution] = React.useState(false);
    return (
        <div className="dc-results">
            {r.won && fresh(my.me, `win-${dc.gameId}`) && <Confetti />}
            <div className={['dc-result-banner', r.won ? 'won' : 'lost'].join(' ')}>
                <h2>{r.won ? 'Home, sweet home!' : 'Time to move out…'}</h2>
                <div className="dc-score"><b>{r.score}</b><span className="dc-muted">/ {r.maxScore} points</span></div>
                <div className="dc-muted small">{r.conditionPoints} for conditions{r.won ? ` + ${r.heartPoints} for ${dc.hearts} heart${dc.hearts === 1 ? '' : 's'} left` : ''}</div>
            </div>
            {dc.players.map(p => {
                const cards = dc.cards ? dc.cards[p.id] : [];
                const met = r.met[p.id] || [];
                return (
                    <div key={p.id} className="dc-panel dc-reveal" style={{ '--a': p.accent } as any}>
                        <div className="dc-panel-title"><span><Avatar p={p} size={22} /> {p.id === my.me ? 'You' : p.name}</span>
                            <span className={['dc-pill', met.every(Boolean) ? 'ok' : ''].join(' ')}>{met.filter(Boolean).length}/{met.length}</span></div>
                        {cards.map((c, i) => (
                            <div key={i} className={['dc-cond', met[i] ? 'met' : ''].join(' ')}><Check ok={!!met[i]} /><ConditionText cond={c} owner={p.id === my.me ? null : p.name} /></div>
                        ))}
                    </div>
                );
            })}
            {dc.solution && (
                <div className="dc-panel">
                    <button className="dc-btn ghost small" onClick={() => setShowSolution(!showSolution)}>{showSolution ? 'Hide' : 'Show'} one house that works</button>
                    {showSolution && <HouseView house={dc.solution} className="dc-solution" board={dc.board} beds={dc.solutionBeds} people={tokenPeople(dc, my.me)} twists={dc.twists} />}
                </div>
            )}
            <div className="dc-muted center small">Scenario {dc.code} · {LEVEL_NAME[dc.level]} · {dc.title}</div>
            {my.isHost && (
                <div className="dc-result-actions">
                    <button className="dc-btn primary" onClick={() => mp.restartGame()}>New scenario</button>
                    <button className="dc-btn" onClick={() => mp.replayScenario()}>Replay this one</button>
                    <button className="dc-btn ghost" onClick={() => mp.backToLobby()}>Lobby</button>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** A player's name in their lobby colour, with their icon. */
const Who: React.FC<{ dc: DCPublic; id: string | null; me: string; lower?: boolean }> = ({ dc, id, me, lower }) => {
    const p = id ? playerOf(dc, id) : null;
    let name = nameOf(dc, id, me);
    if (lower && name === 'You') name = 'you';
    if (!p) return <b>{name}</b>;
    return (
        <span className="dc-who-tag" style={{ '--a': p.accent } as any}>
            <PlayerIcon p={p} /><b>{name}</b>
        </span>
    );
};

const HistoryView: React.FC<{ dc: DCPublic; my: DCPrivate }> = ({ dc, my }) => {
    const items = [...dc.log].reverse();
    return (
        <div className="dc-root dc-history">
            <h3>{dc.title}</h3>
            <div className="dc-muted small">Scenario {dc.code} · {LEVEL_NAME[dc.level]} <Stars n={LEVEL_STARS[dc.level]} /></div>
            {items.length === 0 && <p className="dc-muted">Nothing has changed yet.</p>}
            {items.map(e => {
                if (e.kind === 'meeting' && e.meeting) {
                    return (
                        <div key={e.id} className="dc-hist meeting">
                            <Heart up={false} size={22} />
                            <div>
                                <b>{e.text}</b>{e.meeting.early ? ' (early)' : ''}
                                {e.meeting.moods.map(x => <div key={x.by} className="small"><Who dc={dc} id={x.by} me={my.me} />: &ldquo;{moodText(x.mood, nameOf(dc, x.target, my.me))}&rdquo;</div>)}
                                {e.meeting.shares.map((s, i) => <div key={i} className="small dc-muted"><Who dc={dc} id={s.from} me={my.me} /> shared a condition with <Who dc={dc} id={s.to} me={my.me} lower /></div>)}
                            </div>
                        </div>
                    );
                }
                const p = playerOf(dc, e.by);
                return (
                    <div key={e.id} className="dc-hist" style={{ '--a': p ? p.accent : '#999' } as any}>
                        <MoveIcon e={e} />
                        <div>
                            <div className="small dc-muted">Round {e.round}{dc.segments.length > 1 ? ` · stretch ${e.segment + 1}` : ''}</div>
                            <Who dc={dc} id={e.by} me={my.me} /> {actionText(dc, e, my.me)}.
                            <div className="dc-hist-faces">
                                {dc.players.filter(x => e.reactions[x.id]).map(x => (
                                    <span key={x.id} title={`${x.name}: ${REACTION_LABEL[e.reactions[x.id]]}`}><ReactionFace kind={e.reactions[x.id]} size={18} /><small>{x.id === my.me ? 'You' : x.name}</small></span>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

interface MainState {
    sheet: { room: RoomId; focus: ObjType | 'wall' } | null;
    pending: Pending | null;
    /** Roommates board: choosing whom to kick out of a full bedroom. */
    kickPick: boolean;
    /** Cat twist: choosing where to walk the cat. */
    catPick: boolean;
    viewReq: { view: string; id: number } | null;
}

export class DCMainPage extends React.Component<DCViewProps, MainState> {
    public state: MainState = { sheet: null, pending: null, kickPick: false, catPick: false, viewReq: null };

    private mp(): any { return this.props.MP; }

    componentDidUpdate(prev: DCViewProps) {
        const { dc, my } = this.props;
        const p = prev.dc;
        if (!dc || !my || !p) return;
        if (dc.gameId !== p.gameId) { this.setState({ sheet: null, pending: null, kickPick: false, catPick: false }); return; }

        // a new log entry: the change everyone just saw
        const last = dc.log[dc.log.length - 1];
        const plast = p.log[p.log.length - 1];
        if (last && (!plast || last.id !== plast.id)) {
            if (last.kind === 'move' && last.move) {
                const k = last.move.kind;
                if (k === 'paint') sfx.paint(); else if (k === 'cat') sfx.cat(); else if (k === 'remove') sfx.remove(); else if (k === 'swap') sfx.swap(); else sfx.place();
            } else if (last.kind === 'switch') sfx.door();
            else if (last.kind === 'pass') sfx.pass();
            else if (last.kind === 'meeting') sfx.heart();
            // a pending action may no longer apply now
            if (this.state.pending && this.pendingError(this.state.pending)) this.setState({ pending: null });
            if ((this.state.kickPick || this.state.catPick) && dc.activeId !== my.me) this.setState({ kickPick: false, catPick: false });
        } else if (last && plast && last.id === plast.id) {
            const now = Object.keys(last.reactions), before = Object.keys(plast.reactions);
            const added = now.filter(id => before.indexOf(id) === -1 && id !== my.me);
            if (added.length) { const k = last.reactions[added[0]]; if (k === 'love') sfx.love(); else if (k === 'hate') sfx.hate(); else sfx.meh(); }
        }
        if (dc.phase !== p.phase) {
            if (dc.phase === Phase.Meeting) { sfx.bell(); this.setState({ sheet: null, pending: null, kickPick: false, catPick: false, viewReq: { view: 'home', id: Date.now() } }); }
            if (dc.phase === Phase.Done) { if (dc.result && dc.result.won) sfx.fanfare(); else sfx.sigh(); this.setState({ sheet: null, pending: null, kickPick: false, catPick: false }); }
        }
        if (dc.activeId === my.me && p.activeId !== my.me && dc.phase === Phase.Play) setTimeout(() => sfx.turn(), 350);
        if (my.known.length > (prev.my ? prev.my.known.length : 0)) sfx.share();
    }

    private myTurn(): boolean {
        const { dc, my } = this.props;
        return dc.phase === Phase.Play && dc.activeId === my.me;
    }

    /** Why a staged action can't happen right now (null = fine). */
    private pendingError(a: Pending): string | null {
        const dc = this.props.dc;
        if (isSwitch(a)) return dc.activeId !== this.props.my.me ? 'Not your turn' : switchError(dc.beds, a);
        return moveError(dc.house, a) || this.twistWhy(a);
    }

    /** Why a twist forbids me this change (turn rules only count on my own turn). */
    private twistWhy = (m: Move): string | null => {
        const { dc, my } = this.props;
        if (!dc.twists) return null;
        return twistError(dc.twists, dc.house, m, this.mySeat(), this.myTurn() ? dc.memo : null, ruleOpts(dc, my.me));
    };

    /** Rooms I can't change this turn, with the reason (only shown on my turn). */
    private blockedRooms(): Partial<Record<RoomId, string>> {
        const { dc, my } = this.props;
        const out: Partial<Record<RoomId, string>> = {};
        if (!dc.twists || !this.myTurn()) return out;
        ROOMS.forEach(room => { const why = roomBlocked(dc.twists, room, this.mySeat(), dc.memo, ruleOpts(dc, my.me)); if (why) out[room] = why; });
        return out;
    }

    /** Cat twist: pick a neighbouring room to walk the cat to. */
    private startCat = () => {
        if (!this.props.dc.house.pet || !this.myTurn()) return;
        sfx.tap();
        this.setState({ catPick: true, sheet: null, pending: null, kickPick: false });
    };

    private renderCatPick(): React.ReactNode {
        const { dc } = this.props;
        const from = dc.house.pet;
        if (!this.state.catPick || !from) return null;
        return (
            <Modal onClose={() => this.setState({ catPick: false })} className="dc-kick dc-catpick">
                <h3><CatGlyph size={22} /> Walk the cat</h3>
                <p className="dc-muted small">It&rsquo;s in the {roomName(from, dc.board)}. Where to?</p>
                <div className="dc-kick-opts">
                    {ADJACENT[from].map(room => {
                        const m: Move = { kind: 'cat', room };
                        const why = this.twistWhy(m);
                        return (
                            <button key={room} className="dc-kick-opt" disabled={!!why} title={why || ''}
                                onClick={() => { sfx.select(); this.setState({ catPick: false, pending: m }); }}>
                                <WallSwatch color={dc.house[room].wall} size={36} />
                                <b>{cap(roomName(room, dc.board))}</b>
                                {why && <small className="dc-muted">{why}</small>}
                            </button>
                        );
                    })}
                </div>
            </Modal>
        );
    }

    private mySeat(): number { return seatOfId(this.props.dc, this.props.my.me); }

    /** Roommates board: stage a switch, asking whom to kick out when the other bedroom is full. */
    private startSwitch = () => {
        const dc = this.props.dc;
        if (!dc.beds || !this.myTurn()) return;
        sfx.tap();
        const opts = switchOptions(dc.beds, this.mySeat());
        if (opts.length === 1 && opts[0] === null) this.setState({ pending: { kind: 'switch', seat: this.mySeat(), kick: null }, sheet: null });
        else this.setState({ kickPick: true, sheet: null, pending: null });
    };

    private pickKick = (seat: number) => {
        sfx.select();
        this.setState({ kickPick: false, pending: { kind: 'switch', seat: this.mySeat(), kick: seat } });
    };

    private renderKickPick(): React.ReactNode {
        const { dc, my } = this.props;
        if (!this.state.kickPick || !dc.beds) return null;
        const from = dc.beds[this.mySeat()];
        const to = otherBedroom(from);
        const there = switchOptions(dc.beds, this.mySeat()).filter((x): x is number => x !== null);
        return (
            <Modal onClose={() => this.setState({ kickPick: false })} className="dc-kick">
                <h3>The {roomName(to, dc.board)} is full</h3>
                <p className="dc-muted small">Who do you kick out? They move into the {roomName(from, dc.board)}.</p>
                <div className="dc-kick-opts">
                    {there.map(seat => {
                        const p = playerAtSeat(dc, seat);
                        return p ? (
                            <button key={seat} className="dc-kick-opt" style={{ '--a': p.accent } as any} onClick={() => this.pickKick(seat)}>
                                <Avatar p={p} size={40} />
                                <b>{p.id === my.me ? 'You' : p.name}</b>
                            </button>
                        ) : null;
                    })}
                </div>
            </Modal>
        );
    }

    private onPick = (ref: SlotRef) => {
        if (this.props.dc.phase !== Phase.Play) return;
        sfx.tap();
        this.setState({ sheet: { room: ref.room, focus: ref.type }, pending: null });
    };

    private onMove = (m: Move) => {
        sfx.select();
        this.setState({ pending: m, sheet: null });
    };

    private confirm = () => {
        const m = this.state.pending;
        if (!m || !this.myTurn()) return;
        if (isSwitch(m)) {
            const kicked = m.kick === null ? null : playerAtSeat(this.props.dc, m.kick);
            this.mp().switchRooms(kicked ? kicked.id : null);
        } else {
            this.mp().act(m);
        }
        this.setState({ pending: null });
    };

    private react = (k: Reaction) => {
        const e = lastAction(this.props.dc.log);
        if (!e) return;
        if (k === 'love') sfx.love(); else if (k === 'hate') sfx.hate(); else sfx.meh();
        this.mp().react(e.id, k);
    };

    private renderPrompt(): React.ReactNode {
        const { dc, my } = this.props;
        const pending = this.state.pending;
        if (pending) {
            const err = this.pendingError(pending);
            const before: View = { house: dc.house, beds: dc.beds };
            const after: View = err ? before
                : isSwitch(pending) ? { house: dc.house, beds: applySwitch(dc.beds!, pending) }
                    : { house: applyMove(dc.house, pending), beds: dc.beds };
            const mine = this.myTurn();
            const what = isSwitch(pending)
                ? (dc.beds ? describeSwitch(dc.beds, pending, seatNamer(dc, my.me), dc.board) : '')
                : describeMove(dc.house, pending, dc.board);
            return (
                <div className="dc-panel dc-pending">
                    <div className="dc-pending-text">{mine ? (isSwitch(pending) ? 'You: ' : 'Change: ') : 'Trying: '}<b>{what}</b></div>
                    {!err && <MoveEffects dc={dc} me={my.me} before={before} after={after} card={my.card} known={my.known.map(k => ({ cond: k.cond, who: nameOf(dc, k.from), from: k.from }))} />}
                    <div className="dc-pending-actions">
                        <button className="dc-btn ghost" onClick={() => { sfx.tap(); this.setState({ pending: null }); }}>{mine ? 'Cancel' : 'Clear'}</button>
                        {mine && <button className="dc-btn primary" disabled={!!err || my.owesReaction} onClick={this.confirm}>Confirm</button>}
                    </div>
                    {mine && my.owesReaction && <div className="dc-warn small">React to the last change first.</div>}
                    {!mine && <div className="dc-muted small">Just a preview — it&rsquo;s {nameOf(dc, dc.activeId)}&rsquo;s turn.</div>}
                </div>
            );
        }
        if (!my.isPlayer) return <div className="dc-hint">Watching. {nameOf(dc, dc.activeId)} is deciding…</div>;
        if (this.myTurn()) {
            return (
                <div className="dc-hint mine">
                    <span><b>Your turn.</b> {my.owesReaction ? 'React to the last change, then tap a room.'
                        : `Tap a room to make one change${[dc.beds ? 'switch bedrooms' : '', dc.house.pet ? 'walk the cat' : ''].filter(Boolean).map((x, i, a) => (i === a.length - 1 ? ', or ' : ', ') + x).join('')}.`}</span>
                    <span className="dc-hint-actions">
                        {dc.beds && <button className="dc-btn small" disabled={my.owesReaction} onClick={this.startSwitch}><BedGlyph size={14} /> Switch rooms</button>}
                        {dc.house.pet && <button className="dc-btn small" disabled={my.owesReaction} onClick={this.startCat}><CatGlyph size={14} /> Walk the cat</button>}
                        {my.canPass && <button className="dc-btn small" disabled={my.owesReaction} onClick={() => this.mp().pass()}>Pass</button>}
                    </span>
                </div>
            );
        }
        const a = playerOf(dc, dc.activeId);
        return (
            <div className="dc-hint" style={{ '--a': a ? a.accent : '#999' } as any}>
                {a && <Avatar p={a} size={22} />} <span><b>{a ? a.name : 'Someone'}</b> is deciding… <span className="dc-muted">Tap a room to try ideas.</span></span>
            </div>
        );
    }

    private renderEarly(): React.ReactNode {
        const { dc, my } = this.props;
        if (!dc.canCallEarly || !my.isPlayer) return null;
        const me = playerOf(dc, my.me);
        const votes = dc.players.filter(p => p.votedEarly).length;
        const on = !!(me && me.votedEarly);
        return (
            <div className="dc-early">
                <span className="dc-muted small">Feeling stuck? {votes > 0 ? `${votes}/${dc.players.length} want the first ${meetingName(dc.players.length)} now.` : `Everyone can agree to hold the first ${meetingName(dc.players.length)} early.`}</span>
                <button className={['dc-btn tiny', on ? '' : 'ghost'].join(' ')} onClick={() => { sfx.tap(); this.mp().voteEarly(!on); }}>{on ? 'Withdraw' : 'Call it early'}</button>
            </div>
        );
    }

    private renderHome(): React.ReactNode {
        const { dc, my } = this.props;
        const pending = this.state.pending;
        const pendingOk = !!pending && !this.pendingError(pending);
        const pendingMove = pendingOk && !isSwitch(pending) ? pending as Move : null;
        const pendingSwitch = pendingOk && isSwitch(pending) ? pending : null;
        const showHouse = pendingMove ? applyMove(dc.house, pendingMove) : dc.house;
        const showBeds = pendingSwitch && dc.beds ? applySwitch(dc.beds, pendingSwitch) : dc.beds;
        const last = lastAction(dc.log);
        const isFresh = !!last && fresh(my.me, `mv-${dc.gameId}-${last.id}`);
        const anim = last && last.move && last.before && isFresh
            ? { id: last.id, move: last.move, before: last.before } : null;
        const mark: SlotRef | null = last && last.move && last.move.kind !== 'cat' ? { room: last.move.room, type: last.move.kind === 'paint' ? 'wall' : (last.move as any).type } : null;
        const movedSeats = pendingSwitch ? [pendingSwitch.seat].concat(pendingSwitch.kick === null ? [] : [pendingSwitch.kick])
            : last && last.kind === 'switch' && last.sw && isFresh ? [last.sw.seat].concat(last.sw.kick === null ? [] : [last.sw.kick]) : undefined;

        return (
            <div className="dc-root dc-home">
                <div className="dc-title-row">
                    <span className="dc-scn-title">{dc.title}</span>
                    <Stars n={LEVEL_STARS[dc.level]} />
                </div>
                {dc.phase !== Phase.Done && <RoundTrack dc={dc} />}
                <TwistBar dc={dc} my={my} />
                <PlayerStrip dc={dc} my={my} />
                {dc.phase === Phase.Done && dc.result && <Results dc={dc} my={my} mp={this.mp()} />}
                {dc.phase === Phase.Meeting && dc.meeting && <MeetingPanel dc={dc} my={my} mp={this.mp()} />}
                <div className={['dc-house-wrap', this.myTurn() ? 'mine' : ''].join(' ')}>
                    <HouseView house={showHouse}
                        onPick={dc.phase === Phase.Play ? this.onPick : undefined}
                        selectedRoom={this.state.sheet ? this.state.sheet.room : (pendingMove && pendingMove.kind !== 'cat' ? pendingMove.room : null)}
                        preview={pendingMove ? { move: pendingMove, before: dc.house } : null}
                        animate={pending ? null : anim}
                        mark={pending ? null : mark}
                        board={dc.board} beds={showBeds} people={tokenPeople(dc, my.me)}
                        movedSeats={movedSeats} previewSeats={!!pendingSwitch}
                        twists={dc.twists} blocked={dc.phase === Phase.Play ? this.blockedRooms() : undefined} />
                </div>
                {dc.phase === Phase.Play && this.renderPrompt()}
                {dc.phase !== Phase.Done && <LastChange dc={dc} my={my} onReact={this.react} />}
                {dc.phase !== Phase.Done && my.isPlayer && <CardPanel dc={dc} my={my} house={dc.house} beds={dc.beds} />}
                {dc.phase === Phase.Play && this.renderEarly()}
                {this.state.sheet && (
                    <RoomSheet house={dc.house} room={this.state.sheet.room} focus={this.state.sheet.focus} board={dc.board}
                        why={this.twistWhy} blocked={this.blockedRooms()[this.state.sheet.room] || null}
                        onRoom={room => { sfx.tap(); this.setState({ sheet: { room, focus: 'wall' } }); }}
                        onMove={this.onMove} onClose={() => this.setState({ sheet: null })} />
                )}
                {this.renderKickPick()}
                {this.renderCatPick()}
            </div>
        );
    }

    public render() {
        const { dc, my } = this.props;
        const mp = this.mp();
        if (!dc || !my) return null;

        const needsMe = my.isPlayer && (
            (dc.phase === Phase.Play && (dc.activeId === my.me || my.owesReaction))
            || (dc.phase === Phase.Meeting && !playerOf(dc, my.me)?.meetingDone));

        // condition text everywhere needs the board and who sits where
        const text: DCTextInfo = {
            board: dc.board || 'classic',
            seat: seat => { const p = playerAtSeat(dc, seat); return p ? { name: p.name, accent: p.accent, icon: p.icon, me: p.id === my.me } : null; }
        };
        const withText = (node: React.ReactNode) => <DCText.Provider value={text}>{node}</DCText.Provider>;
        const links: any = {
            'home': { 'icon': 'home', 'label': 'House', 'view': withText(this.renderHome()) },
            'history': { 'icon': 'history', 'label': 'History', 'view': withText(<HistoryView dc={dc} my={my} />) },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        if (my.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Settings',
                'view': (
                    <div className="dc-root dc-settings">
                        <div className="dc-muted small">Scenario {dc.code} · {LEVEL_NAME[dc.level]}</div>
                        <button className="dc-btn" onClick={() => { if (window.confirm('Start a new scenario at the same level?')) mp.restartGame(); }}>New scenario</button>
                        <button className="dc-btn" onClick={() => { if (window.confirm('Restart this same scenario?')) mp.replayScenario(); }}>Restart this scenario</button>
                        <button className="dc-btn ghost" onClick={() => mp.backToLobby()}>Back to lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Décorum',
            'topBarContent': <span className="dc-topbar"><MuteToggle /></span>,
            'roomClassName': needsMe ? 'attention-bg' : '',
            'requestView': this.state.viewReq
        });
    }
}

