/**
 * HookyViews.tsx — React views for Hooky.
 *
 * Presentation only: every mutation goes through an MP RPC method. Sounds and
 * entrance animations are driven by diffing successive props in the main page,
 * so every client sees the same beats: a paper plane, tiles popping onto the
 * board, the answer stamp, the school bell.
 *
 * Built for a phone in portrait: one column, big tap targets. The Notes tab
 * holds the deduction sheet (see HookyNotes.tsx).
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';

import {
    LETTERS, STUDENTS, SETUPS, MIN_PLAYERS, MAX_PLAYERS, HOOKY_COUNT, WORD_LEN, EARLY_POINTS, FINAL_POINTS,
    normaliseWord, isListed, anagramKey, countIn, hookyPointsFor
} from '../HookyData';
import { Phase, Peek, HookyResult } from '../HookyGameState';
import { HKViewProps, HKPublic, HKPrivate, HKPlayer, HKLobbyInfo } from '../HookyTypes';
import { sfx } from '../HookySound';
import {
    StudentCard, Tile, TileWord, Stamp, Avatar, BellGlyph, SlideGlyph, PaperPlane, Title, Confetti, Backdrop,
    MuteToggle, Face, fresh
} from './HookyBits';
import {
    Notes, NotesView, nextMark, GridOrient, LogEntryRow, loadNotes, saveNotes, cellKey, knownOwners, effectiveMark, opponentsOf, HOOKY_COL
} from './HookyNotes';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const nameOf = (hk: HKPublic, id: string | null, me?: string) =>
    id && id === me ? 'You' : ((id && hk.players.find(p => p.id === id)?.name) || 'Someone');

const playerOf = (hk: HKPublic, id: string | null): HKPlayer | undefined => hk.players.find(p => p.id === id);

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const RulesView: React.FC = () => (
    <div className="hk-root hk-rules">
        <Title size={34} />
        <p className="hk-lede">Three students are playing hooky. Ask clever five-letter questions to work out who&rsquo;s
            holding which student and who&rsquo;s missing from class.</p>
        <section>
            <h3>The class</h3>
            <p>26 student cards, one per letter A–Z. Everyone gets a secret hand. A few cards go to the
                <b> Playground</b> face down, and three are the <b>Hooky</b> students: nobody holds them.</p>
            <table className="hk-setup-table">
                <thead><tr><th>Players</th><th>Hand</th><th>Playground</th><th>Rounds</th></tr></thead>
                <tbody>
                    {[3, 4, 5, 6].map(n => (
                        <tr key={n}><td>{n}{n === 6 ? '*' : ''}</td><td>{SETUPS[n].hand}</td><td>{SETUPS[n].playground}</td><td>{SETUPS[n].rounds}</td></tr>
                    ))}
                </tbody>
            </table>
            <p className="hk-muted">* 6 players is a house variant: 3 Playground cards start face up and the game is 5 rounds long.</p>
        </section>
        <section>
            <h3>Introductions</h3>
            <p>Each player gives one 5-letter word that uses at least one of their <i>own</i> letters. The game tells
                everyone how many of their letters are in it.</p>
        </section>
        <section>
            <h3>Asking</h3>
            <p>On your turn, pick another player and a 5-letter word. Everyone learns how many letters of the word are
                in that player&rsquo;s hand. <b>Every occurrence counts</b>: if they hold N and E, NEVER scores 3.</p>
            <p className="hk-muted">You can&rsquo;t ask a player the same letters twice (anagrams count as the same).
                Words not in the word list can still be used, but they&rsquo;re flagged for the table to judge.</p>
        </section>
        <section>
            <h3>Show &amp; tell</h3>
            <p>From round 2, once per turn (before or after asking) you may turn one of your own cards face up. Then you
                secretly peek at a random face-down card from another player&rsquo;s hand.</p>
        </section>
        <section>
            <h3>Recess &amp; the bell</h3>
            <p><SlideGlyph size={18} /> After the early rounds, a Playground card is turned up. Those students are not in
                anyone&rsquo;s hand and not playing hooky.</p>
            <p><BellGlyph size={18} /> After each of the last three rounds, everyone secretly names the 3 Hooky students.</p>
        </section>
        <section>
            <h3>Scoring</h3>
            <ul>
                <li><b>{EARLY_POINTS}</b> per correct Hooky student in the first two guesses.</li>
                <li><b>{FINAL_POINTS}</b> per correct Hooky student in the final guess.</li>
                <li><b>1</b> per student correctly placed in another player&rsquo;s hand at the end.</li>
                <li><b>+1</b> for every opponent whose whole hand you got exactly right.</li>
            </ul>
            <p className="hk-muted">Ties: whoever found a Hooky student earliest, then most found in that guess, then fewest
                cards shown.</p>
        </section>
        <section>
            <h3>Your notes</h3>
            <p>The <b>Notes</b> tab has a private deduction sheet. Tap a square to cycle it through ✓ has it, ✗ not it, ? maybe and blank. Certain facts
                (your cards, face-up cards, the Playground, your peeks) are filled in for you. The rest is your detective work.</p>
        </section>
    </div>
);

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

const LobbyBody: React.FC<{ mp: any; lobby?: HKLobbyInfo; host: boolean }> = ({ mp, lobby, host }) => {
    // playersCount() exists on the host only; clients count the roster the rule sends.
    const n = lobby ? lobby.players.length : (typeof mp.playersCount === 'function' ? mp.playersCount() + 1 : 0);
    const ok = n >= MIN_PLAYERS && n <= MAX_PLAYERS;
    const s = SETUPS[n];
    return (
        <div className="hk-root hk-lobby">
            <Backdrop />
            <Title />
            {mp.getPluginView('lobby', 'SetNameWithLobby')}
            {lobby && (
                <div className="hk-lobby-class">
                    {lobby.players.map((p, i) => (
                        <span key={p.id} className="hk-lobby-kid" style={{ '--d': `${i * 80}ms` } as any}>
                            <Avatar p={p} size={34} />
                            <span>{p.id === mp.clientId ? 'You' : p.name}</span>
                        </span>
                    ))}
                </div>
            )}
            {ok && s
                ? <p className="hk-muted center">{n} players: {s.hand} cards each, {s.playground} on the Playground, {s.rounds} rounds.</p>
                : <p className="hk-warn">{n} player{n > 1 ? 's' : ''} here. Hooky needs {MIN_PLAYERS} to {MAX_PLAYERS}.{host ? ' Starting now will do nothing.' : ''}</p>}
            {!host && <div className="hk-waiting"><Face letter="Z" size={44} sleepy /> Waiting for the host to ring the bell…</div>}
        </div>
    );
};

export class HKHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const lobby: HKLobbyInfo | undefined = (this.props as any).hkLobby;
        const links: any = {
            'home': { 'icon': 'home', 'label': 'Lobby', 'view': <LobbyBody mp={mp} lobby={lobby} host /> },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Hooky', 'links': links });
    }
}

export class HKClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const lobby: HKLobbyInfo | undefined = (this.props as any).hkLobby;
        const links: any = {
            'home': { 'icon': 'id-card', 'label': 'Lobby', 'view': <LobbyBody mp={mp} lobby={lobby} host={false} /> },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Hooky', 'links': links });
    }
}

// ---------------------------------------------------------------------------
// Pieces of the play screen
// ---------------------------------------------------------------------------

const RoundTrack: React.FC<{ hk: HKPublic }> = ({ hk }) => {
    const s = hk.setup;
    const items = [0, ...Array.from({ length: s.rounds }, (_, i) => i + 1)];
    const done = hk.phase === Phase.Final || hk.phase === Phase.Done;
    return (
        <div className="hk-track">
            {items.map(r => {
                const state = done || r < hk.round || (r === hk.round && hk.phase === Phase.Guess)
                    ? 'past' : r === hk.round && hk.phase !== Phase.Clue ? 'now' : r === 0 && hk.phase === Phase.Clue ? 'now' : '';
                return (
                    <div key={r} className={['hk-track-step', state].join(' ')}>
                        <span className="dot">{r === 0 ? 'Hi' : r}</span>
                        <span className="marks">
                            {s.pgAfter.indexOf(r) !== -1 && <SlideGlyph size={14} />}
                            {s.guessAfter.indexOf(r) !== -1 && <BellGlyph size={14} />}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const Banner: React.FC<{ hk: HKPublic; my: HKPrivate }> = ({ hk, my }) => {
    const active = playerOf(hk, hk.activeId);
    const mine = hk.activeId === my.me;
    let text: React.ReactNode = '';
    let cls = '';
    switch (hk.phase) {
        case Phase.Clue:
            text = mine ? 'Your turn: introduce yourself!' : <>{active?.name} is introducing themself…</>;
            break;
        case Phase.Ask:
            text = mine
                ? (hk.turn.asked ? 'Show & tell, or end your turn' : 'Your turn to ask!')
                : (hk.turn.asked ? <>{active?.name} might show &amp; tell…</> : <>{active?.name} is thinking of a word…</>);
            break;
        case Phase.Guess:
            text = <>Hooky check! Who&rsquo;s skipping class? ({hk.lockedIn.length}/{hk.players.length} locked)</>;
            cls = 'bell';
            break;
        case Phase.Final:
            text = <>Final bell! Name everyone&rsquo;s hand. ({hk.finalSubmitted.length}/{hk.players.length} done)</>;
            cls = 'bell';
            break;
        case Phase.Done:
            text = 'Class dismissed!';
            cls = 'done';
            break;
    }
    return (
        <div className={['hk-banner', mine ? 'mine' : '', cls].join(' ')} key={`${hk.phase}-${hk.activeId}-${hk.turn.asked}`}>
            {active && hk.phase !== Phase.Guess && hk.phase !== Phase.Final && <Avatar p={active} size={30} />}
            {(cls === 'bell') && <BellGlyph size={26} />}
            <span>{text}</span>
        </div>
    );
};

const Classroom: React.FC<{ hk: HKPublic; my: HKPrivate }> = ({ hk, my }) => {
    const done = hk.phase === Phase.Done;
    return (
        <div className="hk-class">
            <div className="hk-desks" style={{ '--n': hk.players.length } as any}>
                {hk.players.map(p => {
                    const active = p.id === hk.activeId;
                    const status = hk.phase === Phase.Guess ? (hk.lockedIn.indexOf(p.id) !== -1 ? 'locked' : 'thinking')
                        : hk.phase === Phase.Final ? (hk.finalSubmitted.indexOf(p.id) !== -1 ? 'locked' : 'thinking') : '';
                    const cards = done && hk.hands ? hk.hands[p.id] : null;
                    return (
                        <div key={p.id} className={['hk-desk', active ? 'active' : '', p.id === my.me ? 'me' : '', status].join(' ')}>
                            <div className="hk-desk-who">
                                <Avatar p={p} size={34} />
                                {active && <span className="hk-pencil" aria-hidden="true">✎</span>}
                                {status === 'locked' && <span className="hk-desk-tick">✓</span>}
                            </div>
                            <div className="hk-desk-name">{p.id === my.me ? 'You' : p.name}</div>
                            <div className="hk-desk-cards">
                                {cards
                                    ? cards.map((l, i) => <StudentCard key={l} letter={l} size="xs" anim={fresh(my.me, `end-${p.id}-${l}`) ? 'flip' : null} delay={2400 + i * 90} />)
                                    : <>
                                        {p.revealed.map(l => <StudentCard key={l} letter={l} size="xs" anim={fresh(my.me, `rev-${l}`) ? 'flip' : null} />)}
                                        {Array.from({ length: p.hiddenCount }, (_, i) => <StudentCard key={`h${i}`} look="back" size="xs" />)}
                                    </>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="hk-yard">
                <div className="hk-yard-part playground">
                    <div className="hk-yard-title"><SlideGlyph size={16} /> Playground</div>
                    <div className="hk-yard-cards">
                        {hk.playground.map(l => <StudentCard key={l} letter={l} size="sm" anim={fresh(my.me, `pg-${l}`) ? 'flip' : null} />)}
                        {Array.from({ length: hk.playgroundHidden }, (_, i) => <StudentCard key={`p${i}`} look="back" size="sm" />)}
                    </div>
                </div>
                <div className="hk-yard-part hooky">
                    <div className="hk-yard-title"><BellGlyph size={16} /> Hooky</div>
                    <div className="hk-yard-cards">
                        {hk.hooky
                            ? hk.hooky.map((l, i) => <StudentCard key={l} letter={l} size="sm" anim={fresh(my.me, `hk-${l}`) ? 'flip' : null} delay={700 + i * 700} />)
                            : Array.from({ length: HOOKY_COUNT }, (_, i) => <StudentCard key={i} look="back" size="sm" className="wobble" delay={i * 300} />)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Board: React.FC<{ hk: HKPublic; my: HKPrivate; notes: Notes }> = ({ hk, my, notes }) => {
    const last = [...hk.log].reverse().find(e => e.kind !== 'playground') || hk.log[hk.log.length - 1];
    return (
        <div className="hk-board">
            <div className="hk-board-inner">
                {last
                    ? <LogEntryRow key={last.id} e={last} hk={hk} my={my} notes={notes} owners={knownOwners(hk, my)} big />
                    : <div className="hk-board-empty">Welcome to class! Introductions first.</div>}
            </div>
            <div className="hk-board-ledge"><span className="chalk" /><span className="eraser" /></div>
        </div>
    );
};

/** Five letter slots over a real (invisible) input, so phones get their own keyboard. */
const WordEntry: React.FC<{
    value: string; onChange: (v: string) => void; onEnter: () => void; status: { kind: 'ok' | 'warn' | 'bad' | 'idle'; text: React.ReactNode };
    autoFocus?: boolean;
}> = ({ value, onChange, onEnter, status, autoFocus }) => (
    <div className="hk-entry-wrap">
        <label className={['hk-entry', status.kind].join(' ')}>
            <span className="slots" aria-hidden="true">
                {Array.from({ length: WORD_LEN }, (_, i) => (
                    <Tile key={i} ch={value[i] || ''} empty={!value[i]} caret={i === value.length} size={50} anim={!!value[i]} />
                ))}
            </span>
            <input value={value} maxLength={WORD_LEN + 2} autoCapitalize="characters" autoComplete="off" autoCorrect="off"
                spellCheck={false} enterKeyHint="go" aria-label="Five-letter word" autoFocus={autoFocus}
                onChange={e => {
                    const v = normaliseWord(e.target.value).slice(0, WORD_LEN);
                    if (v.length > value.length) sfx.pop(v.length - 1);
                    onChange(v);
                }}
                onKeyDown={e => { if (e.key === 'Enter') onEnter(); }} />
        </label>
        <div className={['hk-entry-status', status.kind].join(' ')}>{status.text}</div>
    </div>
);

/** A–Z keypad: 7 per row. */
type KeyState = { on?: boolean; dim?: boolean; hint?: boolean; lock?: boolean; badge?: React.ReactNode };
const LetterPad: React.FC<{ keys: Record<string, KeyState>; onTap: (l: string) => void }> = ({ keys, onTap }) => (
    <div className="hk-pad">
        {LETTERS.map(l => {
            const k = keys[l] || {};
            return (
                <button key={l} type="button"
                    className={['hk-key', k.on ? 'on' : '', k.dim ? 'dim' : '', k.hint ? 'hint' : '', k.lock ? 'lock' : ''].join(' ')}
                    onClick={() => onTap(l)} aria-pressed={!!k.on} title={STUDENTS[l]}>
                    <span className="l">{l}</span>
                    <span className="n">{STUDENTS[l]}</span>
                    {k.badge}
                </button>
            );
        })}
    </div>
);

const Modal: React.FC<{ onClose?: () => void; children: React.ReactNode; className?: string }> = ({ onClose, children, className }) => (
    <div className="hk-modal-back" onClick={onClose}>
        <div className={['hk-modal', className || ''].join(' ')} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
);

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const ordinal = (n: number) => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;

const ResultRow: React.FC<{ r: HookyResult; hk: HKPublic; me: string; idx: number }> = ({ r, hk, me, idx }) => {
    const [open, setOpen] = React.useState(r.id === me);
    const p = playerOf(hk, r.id)!;
    return (
        <div className={['hk-result', r.rank === 1 ? 'winner' : '', r.id === me ? 'me' : ''].join(' ')} style={{ '--d': `${3000 + idx * 160}ms` } as any}>
            <button className="hk-result-head" onClick={() => setOpen(!open)} aria-expanded={open}>
                <span className="rank">{r.rank === 1 ? '★' : ordinal(r.rank)}</span>
                <Avatar p={p} size={30} />
                <span className="nm">{r.id === me ? 'You' : p.name}</span>
                <span className="tot"><b>{r.total}</b> pts</span>
                <span className="chev">{open ? '▴' : '▾'}</span>
            </button>
            {open && (
                <div className="hk-result-body">
                    <div className="hk-result-line">
                        <BellGlyph size={16} />
                        <div className="g">
                            {r.hooky.map(h => (
                                <div key={h.round} className="hk-guessline">
                                    <span className="rd">R{h.round}</span>
                                    {h.letters.length
                                        ? h.letters.map(l => <Tile key={l} ch={l} size={24} mark={h.correct.indexOf(l) !== -1 ? 'yes' : 'no'} />)
                                        : <span className="hk-muted">—</span>}
                                    <span className="pts">+{h.points}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {r.hands.map(h => (
                        <div key={h.target} className="hk-guessline hands">
                            <Avatar p={playerOf(hk, h.target)!} size={20} />
                            {h.guess.map(l => <Tile key={l} ch={l} size={22} mark={h.correct.indexOf(l) !== -1 ? 'yes' : 'no'} />)}
                            <span className="pts">+{h.correct.length}{h.exact ? ' +1★' : ''}</span>
                        </div>
                    ))}
                    <div className="hk-muted">Hooky {r.hookyPoints} · hands {r.handPoints} · bonus {r.bonus} · shown {r.reveals}</div>
                </div>
            )}
        </div>
    );
};

const Results: React.FC<{ hk: HKPublic; my: HKPrivate; onAgain?: () => void; onLobby?: () => void }> = ({ hk, my, onAgain, onLobby }) => {
    const res = hk.results || [];
    const winners = res.filter(r => r.rank === 1);
    const iWon = winners.some(w => w.id === my.me);
    return (
        <div className="hk-panel hk-results">
            {iWon && <Confetti />}
            <h3 className="hk-reveal-title">The Hooky three were…</h3>
            <div className="hk-reveal-cards">
                {(hk.hooky || []).map((l, i) => (
                    <StudentCard key={l} letter={l} size="lg" anim="flip" delay={600 + i * 700} />
                ))}
            </div>
            <div className="hk-winner" style={{ '--d': '2800ms' } as any}>
                {winners.length > 1 ? 'Shared top of the class: ' : 'Top of the class: '}
                <b>{winners.map(w => nameOf(hk, w.id, my.me)).join(' & ')}</b>!
            </div>
            <div className="hk-results-list">
                {res.map((r, i) => <ResultRow key={r.id} r={r} hk={hk} me={my.me} idx={i} />)}
            </div>
            {my.isHost && (
                <div className="hk-row center">
                    <button className="hk-btn" onClick={onAgain}>Play again</button>
                    <button className="hk-btn ghost" onClick={onLobby}>Back to lobby</button>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/** The focus-grid layout is a per-browser preference; portrait unless chosen otherwise. */
const ORIENT_KEY = 'hooky_grid_orient';
function loadOrient(): GridOrient {
    try { return localStorage.getItem(ORIENT_KEY) === 'landscape' ? 'landscape' : 'portrait'; } catch (e) { return 'portrait'; }
}
function saveOrient(o: GridOrient) {
    try { localStorage.setItem(ORIENT_KEY, o); } catch (e) { /* storage blocked */ }
}

interface MainState {
    notes: Notes;
    notesGame: number | null;
    notesTab: 'sheet' | 'log';
    focus: string | null;
    compact: boolean;
    orient: GridOrient;
    filter: string;
    target: string | null;
    word: string;
    confirm: { word: string; kind: 'clue' | 'ask' } | null;
    showTell: boolean;
    tellCard: string | null;
    tellTarget: string | null;
    peekShow: Peek | null;
    guessPick: string[];
    guessRound: number | null;
    finalOpp: string | null;
    finalPicks: Record<string, string[]> | null;
    plane: number | null;
}

export class HKMainPage extends React.Component<HKViewProps, MainState> {
    public state: MainState = {
        notes: {}, notesGame: null, notesTab: 'sheet', focus: null, compact: false, orient: loadOrient(), filter: 'all',
        target: null, word: '', confirm: null, showTell: false, tellCard: null, tellTarget: null, peekShow: null,
        guessPick: [], guessRound: null, finalOpp: null, finalPicks: null, plane: null
    };
    private timers: any[] = [];

    private mp(): any { return this.props.MP; }
    private later(fn: () => void, ms: number) { this.timers.push(setTimeout(fn, ms)); }

    // ---- lifecycle --------------------------------------------------------

    componentDidMount() { this.syncNotes(); this.syncPhaseState(null); }
    componentWillUnmount() { this.timers.forEach(t => clearTimeout(t)); }

    private syncNotes() {
        const { hk, my } = this.props;
        if (hk && my && this.state.notesGame !== hk.gameId) {
            this.setState({ notes: loadNotes(hk.gameId, my.me), notesGame: hk.gameId });
        }
    }

    /** Prefill pickers when a guess / final phase opens. */
    private syncPhaseState(prev: HKPublic | null) {
        const { hk, my } = this.props;
        if (!hk || !my) return;
        if (hk.phase === Phase.Guess && this.state.guessRound !== hk.round) {
            const owners = knownOwners(hk, my);
            const marked = LETTERS.filter(l => effectiveMark(this.notesFor(hk), owners, l, HOOKY_COL) === 'yes');
            this.setState({ guessPick: marked.length <= HOOKY_COUNT ? marked : [], guessRound: hk.round });
        }
        if (hk.phase === Phase.Final && !this.state.finalPicks) {
            this.setState({ finalPicks: this.picksFromNotes(), finalOpp: opponentsOf(hk, my.me)[0]?.id || null });
        }
        if (prev && prev.phase !== hk.phase && hk.phase !== Phase.Final) this.setState({ finalPicks: null });
    }

    private notesFor(hk: HKPublic): Notes {
        return this.state.notesGame === hk.gameId ? this.state.notes : loadNotes(hk.gameId, this.props.my.me);
    }

    componentDidUpdate(prev: HKViewProps) {
        this.syncNotes();
        const a = prev.hk, b = this.props.hk;
        const my = this.props.my;
        if (!a || !b || !my) return;
        if (a.gameId !== b.gameId) {
            this.setState({ target: null, word: '', showTell: false, guessRound: null, finalPicks: null, peekShow: null, focus: null });
            return;
        }
        this.syncPhaseState(a);

        // reset the turn UI when the active player changes
        if (a.activeId !== b.activeId || a.phase !== b.phase) {
            this.setState({ target: null, word: '', confirm: null, showTell: false, tellCard: null, tellTarget: null });
            if (b.activeId === my.me && (b.phase === Phase.Ask || b.phase === Phase.Clue)) this.later(() => sfx.turn(), 900);
        }

        // ---- cues for new log entries ----
        const added = b.log.filter(e => !a.log.some(x => x.id === e.id));
        added.forEach((e, i) => {
            const at = i * 500;
            if (e.kind === 'ask' || e.kind === 'clue') {
                if (e.kind === 'ask') { this.setState({ plane: e.id }); this.later(() => sfx.plane(), at); }
                for (let k = 0; k < WORD_LEN; k++) this.later(() => sfx.pop(k), at + 250 + k * 90);
                this.later(() => sfx.stamp(e.count || 0), at + 820);
            } else if (e.kind === 'reveal') {
                this.later(() => sfx.flip(), at);
            } else if (e.kind === 'playground') {
                this.later(() => sfx.whistle(), at + 900);
            }
        });

        const newPeek = my.peeks.find(p => !prev.my || !prev.my.peeks.some(q => q.logId === p.logId));
        if (newPeek) {
            this.setState({ peekShow: newPeek });
            this.later(() => sfx.peek(), 200);
        }

        if (b.phase === Phase.Guess && a.phase !== Phase.Guess) this.later(() => sfx.bell(), 1100);
        if (b.phase === Phase.Final && a.phase !== Phase.Final) sfx.bell();
        if (b.phase === Phase.Done && a.phase !== Phase.Done) {
            sfx.drumroll();
            [600, 1300, 2000].forEach(t => this.later(() => sfx.flip(), t));
            this.later(() => sfx.fanfare(), 2700);
        }
    }

    // ---- notes ------------------------------------------------------------

    private onCell = (letter: string, col: string) => {
        const { hk, my } = this.props;
        const notes = { ...this.state.notes };
        const k = cellKey(letter, col);
        const next = nextMark(notes[k]);
        if (next) notes[k] = next; else delete notes[k];
        sfx.scribble();
        this.setState({ notes });
        saveNotes(hk.gameId, my.me, notes);
    };

    private clearNotes = () => {
        const { hk, my } = this.props;
        this.setState({ notes: {} });
        saveNotes(hk.gameId, my.me, {});
    };

    // ---- actions ----------------------------------------------------------

    private submitWord(force = false) {
        const { hk } = this.props;
        const w = this.state.word;
        const st = this.wordStatus();
        if (st.kind === 'bad' || w.length !== WORD_LEN) { sfx.buzz(); return; }
        if (!force && !isListed(w)) { this.setState({ confirm: { word: w, kind: hk.phase === Phase.Clue ? 'clue' : 'ask' } }); return; }
        if (hk.phase === Phase.Clue) this.mp().giveClue(w, force);
        else if (this.state.target) this.mp().ask(this.state.target, w, force);
        sfx.select();
        this.setState({ confirm: null, word: '' });
    }

    private wordStatus(): { kind: 'ok' | 'warn' | 'bad' | 'idle'; text: React.ReactNode } {
        const { hk, my } = this.props;
        const w = this.state.word;
        if (w.length < WORD_LEN) return { kind: 'idle', text: `${WORD_LEN - w.length} more letter${WORD_LEN - w.length === 1 ? '' : 's'}` };
        if (hk.phase === Phase.Clue) {
            const n = countIn(w, my.hand);
            if (n === 0) return { kind: 'bad', text: 'Use at least one of your own letters' };
            return isListed(w)
                ? { kind: 'ok', text: <>Everyone will see <b>{n}</b></> }
                : { kind: 'warn', text: <>Not in our word list. You hold <b>{n}</b>.</> };
        }
        const t = this.state.target;
        if (!t) return { kind: 'bad', text: 'Pick who to ask' };
        if ((my.usedKeys[t] || []).indexOf(anagramKey(w)) !== -1) return { kind: 'bad', text: `${nameOf(hk, t)} was already asked these letters` };
        return isListed(w) ? { kind: 'ok', text: 'Good word!' } : { kind: 'warn', text: 'Not in our word list (you can still use it)' };
    }

    private doTell = () => {
        const { tellCard, tellTarget } = this.state;
        if (!tellCard || !tellTarget) { sfx.buzz(); return; }
        this.mp().reveal(tellCard, tellTarget);
        sfx.flip();
        this.setState({ showTell: false, tellCard: null, tellTarget: null });
    };

    private toggleGuess = (l: string) => {
        const g = this.state.guessPick;
        if (g.indexOf(l) !== -1) this.setState({ guessPick: g.filter(x => x !== l) });
        else if (g.length < HOOKY_COUNT) { sfx.pop(g.length); this.setState({ guessPick: [...g, l] }); }
        else sfx.buzz();
    };

    /** Each opponent: certain cards first, then ✓ marks from the sheet, up to hand size. */
    private picksFromNotes(): Record<string, string[]> {
        const { hk, my } = this.props;
        const owners = knownOwners(hk, my);
        const notes = this.notesFor(hk);
        const out: Record<string, string[]> = {};
        opponentsOf(hk, my.me).forEach(p => {
            const sure = LETTERS.filter(l => owners[l] === p.id);
            const marked = LETTERS.filter(l => !owners[l] && notes[cellKey(l, p.id)] === 'yes');
            out[p.id] = [...sure, ...marked].slice(0, hk.setup.hand);
        });
        return out;
    }

    private toggleFinal = (l: string) => {
        const { hk } = this.props;
        const opp = this.state.finalOpp;
        const picks = { ...(this.state.finalPicks || {}) };
        if (!opp) return;
        const cur = picks[opp] || [];
        if (cur.indexOf(l) !== -1) picks[opp] = cur.filter(x => x !== l);
        else if (cur.length < hk.setup.hand) { sfx.pop(cur.length % 5); picks[opp] = [...cur, l]; }
        else { sfx.buzz(); return; }
        this.setState({ finalPicks: picks });
        // hop to the next unfinished opponent once this hand is full
        if (picks[opp].length === hk.setup.hand) {
            const next = opponentsOf(hk, this.props.my.me).find(p => (picks[p.id] || []).length < hk.setup.hand);
            if (next) this.later(() => this.setState({ finalOpp: next.id }), 350);
        }
    };

    // ---- panels -----------------------------------------------------------

    private renderClue() {
        const { my } = this.props;
        return (
            <div className="hk-panel hk-action">
                <h3>Introduce yourself</h3>
                <p className="hk-muted">Give a 5-letter word that uses at least one of your letters. Everyone learns how many of
                    your letters are in it.</p>
                <WordEntry value={this.state.word} onChange={word => this.setState({ word })} onEnter={() => this.submitWord()}
                    status={this.wordStatus()} />
                <div className="hk-hand-hint">Your letters: {my.hand.map(l => <Tile key={l} ch={l} size={24} />)}</div>
                <button className="hk-btn big" disabled={this.wordStatus().kind === 'bad' || this.state.word.length < WORD_LEN}
                    onClick={() => this.submitWord()}>Say it!</button>
            </div>
        );
    }

    private renderTell() {
        const { hk, my } = this.props;
        if (!my.canReveal) return null;
        const hidden = my.hand.filter(l => (playerOf(hk, my.me)?.revealed || []).indexOf(l) === -1);
        if (!this.state.showTell) {
            return (
                <button className="hk-btn ghost hk-tell-open" onClick={() => this.setState({ showTell: true })}>
                    Show &amp; tell: flip a card, peek at someone
                </button>
            );
        }
        return (
            <div className="hk-tell">
                <div className="hk-label">1 · Pick one of your cards to show everyone</div>
                <div className="hk-cards-row">
                    {hidden.map(l => (
                        <StudentCard key={l} letter={l} size="sm" selected={this.state.tellCard === l}
                            onClick={() => { sfx.tap(); this.setState({ tellCard: l }); }} />
                    ))}
                </div>
                <div className="hk-label">2 · Peek at a random card from…</div>
                <div className="hk-targets">
                    {my.peekTargets.map(id => {
                        const p = playerOf(hk, id)!;
                        return (
                            <button key={id} className={['hk-target', this.state.tellTarget === id ? 'on' : ''].join(' ')}
                                onClick={() => { sfx.tap(); this.setState({ tellTarget: id }); }}>
                                <Avatar p={p} size={30} /><span>{p.name}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="hk-row">
                    <button className="hk-btn" disabled={!this.state.tellCard || !this.state.tellTarget} onClick={this.doTell}>Show &amp; peek</button>
                    <button className="hk-btn ghost" onClick={() => this.setState({ showTell: false, tellCard: null, tellTarget: null })}>Never mind</button>
                </div>
            </div>
        );
    }

    private renderAsk() {
        const { hk, my } = this.props;
        if (hk.turn.asked) {
            return (
                <div className="hk-panel hk-action">
                    <h3>Question asked!</h3>
                    {this.renderTell()}
                    {!this.state.showTell && <button className="hk-btn big" onClick={() => this.mp().endTurn()}>End my turn</button>}
                </div>
            );
        }
        const st = this.wordStatus();
        return (
            <div className="hk-panel hk-action">
                <h3>Who do you want to ask?</h3>
                <div className="hk-targets">
                    {opponentsOf(hk, my.me).map(p => (
                        <button key={p.id} className={['hk-target', this.state.target === p.id ? 'on' : ''].join(' ')}
                            onClick={() => { sfx.tap(); this.setState({ target: p.id }); }}>
                            <Avatar p={p} size={34} /><span>{p.name}</span>
                        </button>
                    ))}
                </div>
                <WordEntry value={this.state.word} onChange={word => this.setState({ word })} onEnter={() => this.submitWord()} status={st} />
                <button className="hk-btn big" disabled={st.kind === 'bad' || st.kind === 'idle'} onClick={() => this.submitWord()}>
                    Ask{this.state.target ? ` ${nameOf(hk, this.state.target)}` : ''}!
                </button>
                {hk.round === 1 && <p className="hk-muted center">Show &amp; tell opens from round 2.</p>}
                {this.renderTell()}
            </div>
        );
    }

    private renderGuess() {
        const { hk, my } = this.props;
        const mine = my.myGuesses[hk.round];
        const pts = hookyPointsFor(hk.setup, hk.round);
        const past = hk.setup.guessAfter.filter(r => r < hk.round && my.myGuesses[r]);
        if (mine) {
            return (
                <div className="hk-panel hk-action locked">
                    <h3>Locked in!</h3>
                    <div className="hk-row center">{mine.map(l => <StudentCard key={l} letter={l} size="sm" />)}</div>
                    <p className="hk-muted center">Waiting for {hk.players.filter(p => hk.lockedIn.indexOf(p.id) === -1).map(p => p.name).join(', ')}…</p>
                </div>
            );
        }
        const owners = knownOwners(hk, my);
        const notes = this.state.notes;
        const keys: Record<string, KeyState> = {};
        LETTERS.forEach(l => {
            keys[l] = {
                on: this.state.guessPick.indexOf(l) !== -1,
                dim: !!owners[l],
                hint: effectiveMark(notes, owners, l, HOOKY_COL) === 'yes'
            };
        });
        return (
            <div className="hk-panel hk-action">
                <h3><BellGlyph size={22} /> Who&rsquo;s playing hooky?</h3>
                <p className="hk-muted">Pick {HOOKY_COUNT} students. Each one you get right is worth <b>{pts}</b> points.
                    Faded keys are students you know are in class. Starred keys are your ✓ marks.</p>
                {past.length > 0 && (
                    <div className="hk-pastguess">Your earlier guesses: {past.map(r => (
                        <span key={r} className="g"><i>R{r}</i>{my.myGuesses[r].join(' ')}</span>
                    ))}</div>
                )}
                <div className="hk-pick-slots">
                    {Array.from({ length: HOOKY_COUNT }, (_, i) => {
                        const l = this.state.guessPick[i];
                        return l
                            ? <StudentCard key={l} letter={l} size="sm" anim="pop" onClick={() => this.toggleGuess(l)} />
                            : <span key={`e${i}`} className="hk-slot-empty">?</span>;
                    })}
                </div>
                <LetterPad keys={keys} onTap={this.toggleGuess} />
                <button className="hk-btn big" disabled={this.state.guessPick.length !== HOOKY_COUNT}
                    onClick={() => { sfx.lock(); this.mp().guessHooky(this.state.guessPick); }}>Lock in</button>
            </div>
        );
    }

    private renderFinal() {
        const { hk, my } = this.props;
        if (my.myFinal) {
            return (
                <div className="hk-panel hk-action locked">
                    <h3>Handed in!</h3>
                    <p className="hk-muted center">Waiting for {hk.players.filter(p => hk.finalSubmitted.indexOf(p.id) === -1).map(p => p.name).join(', ')}…</p>
                </div>
            );
        }
        const opps = opponentsOf(hk, my.me);
        const picks = this.state.finalPicks || {};
        const opp = this.state.finalOpp || opps[0]?.id;
        const owners = knownOwners(hk, my);
        const n = hk.setup.hand;
        const cur = picks[opp] || [];
        const keys: Record<string, KeyState> = {};
        LETTERS.forEach(l => {
            const elsewhere = opps.find(p => p.id !== opp && (picks[p.id] || []).indexOf(l) !== -1);
            const known = owners[l];
            keys[l] = {
                on: cur.indexOf(l) !== -1,
                dim: !!known && known !== opp,
                hint: !known && this.state.notes[cellKey(l, opp)] === 'yes',
                badge: elsewhere ? <span className="who" style={{ background: elsewhere.accent }} /> : undefined
            };
        });
        const complete = opps.every(p => (picks[p.id] || []).length === n);
        return (
            <div className="hk-panel hk-action">
                <h3>Who sits where?</h3>
                <p className="hk-muted">Name all {n} students in each classmate&rsquo;s hand. 1 point each, +1 for a perfect hand.</p>
                <div className="hk-opp-tabs">
                    {opps.map(p => {
                        const c = (picks[p.id] || []).length;
                        return (
                            <button key={p.id} className={['hk-opp-tab', p.id === opp ? 'on' : '', c === n ? 'full' : ''].join(' ')}
                                onClick={() => this.setState({ finalOpp: p.id })}>
                                <Avatar p={p} size={24} /><span className="nm">{p.name}</span><span className="c">{c}/{n}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="hk-pick-slots">
                    {Array.from({ length: n }, (_, i) => {
                        const l = cur[i];
                        return l
                            ? <StudentCard key={l} letter={l} size="xs" anim="pop" onClick={() => this.toggleFinal(l)} />
                            : <span key={`e${i}`} className="hk-slot-empty sm">?</span>;
                    })}
                </div>
                <LetterPad keys={keys} onTap={this.toggleFinal} />
                <div className="hk-row">
                    <button className="hk-btn ghost small" onClick={() => this.setState({ finalPicks: this.picksFromNotes() })}>Refill from my notes</button>
                    <button className="hk-btn big" disabled={!complete} onClick={() => { sfx.lock(); this.mp().submitFinal(picks); }}>
                        {complete ? 'Hand it in' : `${opps.filter(p => (picks[p.id] || []).length < n).length} hand(s) to finish`}
                    </button>
                </div>
            </div>
        );
    }

    private renderHand() {
        const { hk, my } = this.props;
        if (!my.isPlayer) return null;
        const me = playerOf(hk, my.me);
        const revealed = me ? me.revealed : [];
        return (
            <div className="hk-panel hk-myhand">
                <div className="hk-section-title">Your students <span className="hk-muted">secret unless shown</span></div>
                <div className="hk-cards-row">
                    {my.hand.map((l, i) => (
                        <StudentCard key={l} letter={l} size="md" anim={fresh(my.me, `deal-${hk.gameId}-${l}`) ? 'deal' : null} delay={i * 90}
                            badge={revealed.indexOf(l) !== -1 ? <span className="hk-badge shown">shown</span> : undefined} />
                    ))}
                </div>
                {my.peeks.length > 0 && (
                    <div className="hk-peeks">
                        <span className="hk-label">Your peeks</span>
                        {my.peeks.map(pk => (
                            <span key={pk.logId} className="hk-peek-chip">
                                <Avatar p={playerOf(hk, pk.target)!} size={18} /> has <Tile ch={pk.letter} size={20} /> {STUDENTS[pk.letter]}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    private renderHome() {
        const { hk, my } = this.props;
        const mine = hk.activeId === my.me;
        let action: React.ReactNode = null;
        if (my.isPlayer) {
            if (hk.phase === Phase.Clue && mine) action = this.renderClue();
            else if (hk.phase === Phase.Ask && mine) action = this.renderAsk();
            else if (hk.phase === Phase.Guess) action = this.renderGuess();
            else if (hk.phase === Phase.Final) action = this.renderFinal();
        }
        const done = hk.phase === Phase.Done;
        return (
            <div className="hk-root hk-play">
                <Backdrop />
                {this.state.plane != null && <PaperPlane id={this.state.plane} />}
                {!done && <RoundTrack hk={hk} />}
                <Banner hk={hk} my={my} />
                {done && <Results hk={hk} my={my} onAgain={() => this.mp().restartGame()} onLobby={() => this.mp().backToLobby()} />}
                <Classroom hk={hk} my={my} />
                {!done && <Board hk={hk} my={my} notes={this.state.notes} />}
                {action}
                {!done && this.renderHand()}
                {this.state.confirm && (
                    <Modal onClose={() => this.setState({ confirm: null })}>
                        <TileWord word={this.state.confirm.word} size={36} />
                        <p><b>{this.state.confirm.word}</b> isn&rsquo;t in our word list. Use it anyway? It&rsquo;ll be marked
                            <span className="hk-unlisted">unlisted</span> so the class can object.</p>
                        <div className="hk-row center">
                            <button className="hk-btn" onClick={() => this.submitWord(true)}>Use it</button>
                            <button className="hk-btn ghost" onClick={() => this.setState({ confirm: null })}>Change it</button>
                        </div>
                    </Modal>
                )}
                {this.state.peekShow && (
                    <Modal className="peek" onClose={() => this.setState({ peekShow: null })}>
                        <div className="hk-peek-title">Psst…</div>
                        <StudentCard letter={this.state.peekShow.letter} size="lg" anim="flip" delay={150} />
                        <p><b>{nameOf(hk, this.state.peekShow.target)}</b> has <b>{STUDENTS[this.state.peekShow.letter]}</b> ({this.state.peekShow.letter}).
                            Only you saw it. It&rsquo;s filled in on your sheet.</p>
                        <button className="hk-btn" onClick={() => this.setState({ peekShow: null })}>Got it</button>
                    </Modal>
                )}
            </div>
        );
    }

    public render() {
        const { hk, my } = this.props;
        const mp = this.props.MP;
        if (!hk || !my) return null;

        const needsMe = my.isPlayer && (
            ((hk.phase === Phase.Clue || hk.phase === Phase.Ask) && hk.activeId === my.me)
            || (hk.phase === Phase.Guess && !my.myGuesses[hk.round])
            || (hk.phase === Phase.Final && !my.myFinal));

        const links: any = {
            'home': { 'icon': 'school', 'label': 'Class', 'view': this.renderHome() },
            'notes': {
                'icon': 'clipboard-list', 'label': 'Notes',
                'view': (
                    <NotesView hk={hk} my={my} notes={this.state.notes} tab={this.state.notesTab}
                        filter={this.state.filter}
                        onCell={this.onCell}
                        onTab={notesTab => this.setState({ notesTab })}
                        onFilter={filter => this.setState({ filter })}
                        onClear={this.clearNotes}
                        focus={this.state.focus}
                        onFocus={focus => { sfx.tap(); this.setState({ focus }); }}
                        compact={this.state.compact}
                        onCompact={compact => this.setState({ compact })}
                        orient={this.state.orient}
                        onOrient={orient => { sfx.tap(); saveOrient(orient); this.setState({ orient }); }} />
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        if (my.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Settings',
                'view': (
                    <div className="hk-root hk-settings">
                        <button className="hk-btn" onClick={() => { if (window.confirm('Restart with a new deal?')) this.mp().restartGame(); }}>Restart game</button>
                        <button className="hk-btn ghost" onClick={() => this.mp().backToLobby()}>Back to lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Hooky',
            'topBarContent': <span className="hk-topbar"><MuteToggle /></span>,
            'roomClassName': needsMe ? 'attention-bg' : ''
        });
    }
}
