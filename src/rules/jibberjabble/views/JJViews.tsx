/**
 * JJViews.tsx — React views for Jibber Jabble.
 *
 * Presentation only: every mutation goes through an MP RPC method. Sounds and
 * speech bubbles are driven by diffing successive props in the main page, so
 * every client hears/sees the same beats (a letter landing, a STOP slam, a
 * "Jibber!") no matter who caused them.
 *
 * Built for a phone in portrait: one column, letter blocks sized to the clue.
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';

import {
    MIN_PLAYERS, MAX_PLAYERS, MIN_ROUNDS, MAX_ROUNDS, MAX_CLUE_LEN, HINT_BY_ID, HINT_CARDS, CHALLENGES,
    RANKS, NONSENSE, EMOTES, EmoteId, isEmote, tierOf, normalise, TEAMS, MIN_TEAM_SIZE, MIN_TEAM_PLAYERS,
    Tier, TIER_LABEL, TIER_POINTS, CARD_COUNT
} from '../JJData';
import { Phase, Clue, Signal, SignalKind } from '../JJGameState';
import { JJViewProps, JJPublic, JJPrivate, JJPlayer, JJLobbyInfo, JJRival } from '../JJTypes';
import { sfx } from '../JJSound';
import {
    LetterBlock, BlockWord, ScrambleWord, Blabbit, Avatar, TierPill, HintGlyph, StopSign, Confetti,
    Backdrop, MuteToggle, EmoteFace, colourFor, tiltFor, blockSizeFor, seenMap
} from './JJBits';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const ANIM_WINDOW = 1400;   // ms a fresh element keeps its entrance class

/**
 * First-sight bookkeeping: the first render that meets `key` stamps it, and
 * the element keeps its entrance animation class for ANIM_WINDOW so later
 * re-renders don't cut the animation short. Returns null once it's old news.
 */
function fresh(me: string, key: string | number, delay = 0): { delay: number } | null {
    const seen = seenMap(me);
    const now = Date.now();
    let rec = seen.get(key);
    if (!rec) { rec = { t: now, delay }; seen.set(key, rec); }
    return now - rec.t < ANIM_WINDOW + rec.delay ? { delay: rec.delay } : null;
}

function isNew(me: string, key: string | number): boolean {
    return !seenMap(me).has(key);
}

const playerMap = (jj: JJPublic) => {
    const m: Record<string, JJPlayer> = {};
    jj.players.forEach(p => { m[p.id] = p; });
    return m;
};

const nameOf = (jj: JJPublic, id: string | null) =>
    (id && jj.players.find(p => p.id === id)?.name) || 'Someone';

/** 2 → "2", 2.5 → "2.5" */
export const fmtPts = (n: number) => (Math.round(n * 2) / 2).toString();

const nonsense = (seed: number) => NONSENSE[Math.abs(seed) % NONSENSE.length];

// ---------------------------------------------------------------------------
// Title (lobby + rules)
// ---------------------------------------------------------------------------

const TitleBlocks: React.FC<{ size?: number }> = ({ size = 38 }) => (
    <div className="jj-title">
        <BlockWord word="JIBBER" size={size} anim="drop" stagger={70} />
        <BlockWord word="JABBLE" size={size} anim="drop" stagger={70} offset={3} className="second" />
    </div>
);

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const RulesView: React.FC = () => (
    <div className="jj-root jj-rules">
        <TitleBlocks size={30} />
        <p className="jj-lede">Spell out clues one letter at a time. Try not to get jumbled!</p>

        <section>
            <h3>The goal</h3>
            <p>A fully cooperative word game. One player — the <b>Guesser</b> — tries to guess a secret word that
                everyone else knows. The others spell clues <b>one letter at a time</b>, taking turns, without
                discussing what they&rsquo;re spelling.</p>
        </section>
        <section>
            <h3>1 · Choose</h3>
            <p>A word card is drawn. The player to the Guesser&rsquo;s left picks 1 of its 6 words. Everyone can see
                the number, so the Guesser knows how hard it is:</p>
            <div className="jj-tier-row">
                <TierPill tier="easy" num={1} /><TierPill tier="medium" num={3} /><TierPill tier="hard" num={5} />
            </div>
            <p className="jj-muted">1–2 easy · 3–4 medium · 5–6 hard. Tip: over 6 rounds, try 2 of each.</p>
            <p className="jj-muted">Word cards: <b>Classic</b> uses the {CARD_COUNT} fixed cards. <b>Jumbled</b> deals
                every card fresh from the word pile, and no word shows up twice in the same game.</p>
        </section>
        <section>
            <h3>2 · Spell 3 clues</h3>
            <p>Starting left of the Guesser, each speller adds a <b>single letter</b> to the current clue, clockwise.
                At the start of your turn you may hit <b>STOP</b> instead — that clue is finished (or beyond saving)
                — and then you give the <b>first letter of the next clue</b>. Stopping the 3rd clue ends spelling.</p>
            <p>The only chatter allowed: <b>&ldquo;Jibber!&rdquo;</b> (I get it) and <b>&ldquo;Jabble?&rdquo;</b> (I&rsquo;m lost).
                Clues can be anything — acronyms, names, several words, misspellings — just never the secret word itself.</p>
        </section>
        <section>
            <h3>3 · Guess</h3>
            <p>The Guesser gets <b>one</b> guess. Right = 1 point. (Plural slips are forgiven, and spellers can
                overrule a near-miss with <b>&ldquo;We&rsquo;ll allow it!&rdquo;</b>.) Then the next player becomes the Guesser.</p>
        </section>
        <section>
            <h3>Ranks after 6 rounds</h3>
            <div className="jj-ranks">
                {RANKS.map((r, i) => (
                    <div key={r.title} className="jj-rank-row">
                        <span className="pts">{i === 0 ? '0–1' : i === 3 ? '6' : `${r.min}–${r.min + 1}`}</span>
                        <span>{r.title}</span>
                    </div>
                ))}
            </div>
        </section>
        <section>
            <h3>Team mode (6+ players)</h3>
            <p>Split into <b>Team Jibber</b> and <b>Team Jabber</b> (at least 3 each). Both teams get the same card: one team picks the <b>difficulty</b> (this alternates every round), then the other team picks <b>which word</b> in that band. Both teams then spell that same word at the same time, each with its own Guesser.</p>
            <p>You can&rsquo;t see the other team&rsquo;s clues while you play — only how far along they are. Once your Guesser has guessed, you <b>spectate</b> them live. Only the rival team can say &ldquo;We&rsquo;ll allow it!&rdquo; for your near-miss. Jibber!/Jabble? stay inside your team; faces are seen by everyone. Hint cards are off in team mode.</p>
            <p><b>Scoring:</b> a word is worth its difficulty — Easy <b>1</b>, Medium <b>2</b>, Hard <b>3</b>. If both teams guess it, the team that locked in its guess <b>first</b> earns a bonus <b>+½</b>.</p>
        </section>
        <section>
            <h3>Hint cards (optional)</h3>
            <p className="jj-muted">Everyone gets one random hint, face up, usable once per game. You <i>may</i> talk
                about when to use hints.</p>
            <div className="jj-hint-list">
                {HINT_CARDS.map(h => (
                    <div key={h.id} className="jj-hint-mini">
                        <HintGlyph id={h.id} size={22} />
                        <div><b>{h.name}</b><span>{h.text}</span></div>
                    </div>
                ))}
            </div>
        </section>
        <section>
            <h3>Challenges</h3>
            <div className="jj-hint-list">
                {CHALLENGES.map(c => (
                    <div key={c.id} className="jj-hint-mini"><div><b>{c.name}</b><span>{c.text}</span></div></div>
                ))}
            </div>
        </section>
    </div>
);

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

export class JJHostLobby extends React.Component<ViewPropsInterface, {}> {
    private set(key: string, v: any) { (this.props.MP as any).setOption(key, v); }

    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const rounds = Number(mp.getData('jj_rounds')) || 6;
        const clues = Number(mp.getData('jj_clues')) === 2 ? 2 : 3;
        const hints = mp.getData('jj_hints') !== false;
        const mixed = mp.getData('jj_cards') === 'mixed';
        const lobby: JJLobbyInfo | undefined = (this.props as any).jjLobby;
        const teamsAllowed = playerCount >= MIN_TEAM_PLAYERS;
        const teamMode = mp.getData('jj_mode') === 'teams' && teamsAllowed;
        const teamsOk = !teamMode || !lobby || lobby.teams.every(t => t.length >= MIN_TEAM_SIZE);
        const ok = playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS && teamsOk;
        const links: any = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div className="jj-root jj-lobby">
                        <Backdrop />
                        <TitleBlocks />
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="jj-panel jj-options">
                            <div className="jj-opt">
                                <span className="jj-opt-label">Mode</span>
                                <div className="jj-seg">
                                    <button className={!teamMode ? 'on' : ''} onClick={() => this.set('mode', 'coop')}>Co-op</button>
                                    <button className={teamMode ? 'on' : ''} disabled={!teamsAllowed}
                                        title={teamsAllowed ? '' : `Needs ${MIN_TEAM_PLAYERS}+ players`}
                                        onClick={() => this.set('mode', 'teams')}>Teams{teamsAllowed ? '' : ` (${MIN_TEAM_PLAYERS}+)`}</button>
                                </div>
                            </div>
                            <div className="jj-opt">
                                <span className="jj-opt-label">Rounds</span>
                                <div className="jj-stepper">
                                    <button className="jj-btn small" disabled={rounds <= MIN_ROUNDS} onClick={() => this.set('rounds', rounds - 1)}>−</button>
                                    <b>{rounds}</b>
                                    <button className="jj-btn small" disabled={rounds >= MAX_ROUNDS} onClick={() => this.set('rounds', rounds + 1)}>+</button>
                                </div>
                            </div>
                            <div className="jj-opt">
                                <span className="jj-opt-label">Clues per round</span>
                                <div className="jj-seg">
                                    <button className={clues === 3 ? 'on' : ''} onClick={() => this.set('clues', 3)}>3 · standard</button>
                                    <button className={clues === 2 ? 'on' : ''} onClick={() => this.set('clues', 2)}>2 · Buzzer Beater</button>
                                </div>
                            </div>
                            <div className="jj-opt">
                                <span className="jj-opt-label">Word cards</span>
                                <div className="jj-seg">
                                    <button className={!mixed ? 'on' : ''} title={`The ${CARD_COUNT} printed cards`}
                                        onClick={() => this.set('cards', 'fixed')}>{CARD_COUNT} classic</button>
                                    <button className={mixed ? 'on' : ''} title="Every card is dealt fresh from the word pile — no word shows up twice in a game"
                                        onClick={() => this.set('cards', 'mixed')}>Jumbled</button>
                                </div>
                            </div>
                            <div className="jj-opt">
                                <span className="jj-opt-label">Hint cards</span>
                                {teamMode
                                    ? <span className="jj-muted">Off in team mode</span>
                                    : (
                                        <div className="jj-seg">
                                            <button className={hints ? 'on' : ''} onClick={() => this.set('hints', true)}>On</button>
                                            <button className={!hints ? 'on' : ''} onClick={() => this.set('hints', false)}>Off</button>
                                        </div>
                                    )}
                            </div>
                        </div>
                        {teamMode && lobby && (
                            <TeamsEditor lobby={lobby} me={mp.clientId}
                                onMove={(id, t) => (mp as any).setTeam(id, t)}
                                onShuffle={() => (mp as any).shuffleTeams()} />
                        )}
                        {ok
                            ? <p className="jj-muted center">{playerCount} players ready to jibber. ({MIN_PLAYERS}–{MAX_PLAYERS} supported)</p>
                            : !teamsOk
                                ? <p className="jj-warn">Each team needs at least {MIN_TEAM_SIZE} players. Starting now will do nothing.</p>
                                : <p className="jj-warn">{playerCount} player{playerCount > 1 ? 's' : ''} connected — Jibber Jabble needs {MIN_PLAYERS} to {MAX_PLAYERS}. Starting now will do nothing.</p>}
                    </div>
                )
            },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Jibber Jabble', 'links': links });
    }
}

export class JJClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card', 'label': 'Lobby',
                'view': (
                    <div className="jj-root jj-lobby">
                        <Backdrop />
                        <TitleBlocks />
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        {(() => {
                            const lobby: JJLobbyInfo | undefined = (this.props as any).jjLobby;
                            return lobby && lobby.mode === 'teams' && lobby.players.length >= MIN_TEAM_PLAYERS
                                ? <TeamsEditor lobby={lobby} me={mp.clientId} />
                                : null;
                        })()}
                        <div className="jj-waiting"><Blabbit mood="sleepy" size={54} /> Waiting for the host to start…</div>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Jibber Jabble', 'links': links });
    }
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

/** Two rosters side by side. With `onMove` (host) each chip hops teams on tap. */
const TeamsEditor: React.FC<{
    lobby: JJLobbyInfo; me: string; onMove?: (id: string, team: number) => void; onShuffle?: () => void;
}> = ({ lobby, me, onMove, onShuffle }) => {
    const byId: Record<string, JJPlayer> = {};
    lobby.players.forEach(p => { byId[p.id] = p; });
    return (
        <div className="jj-panel jj-teams-editor">
            <div className="jj-section-title">
                Teams
                <span className="jj-muted">{onMove ? 'tap a player to swap sides' : 'the host sets the teams'}</span>
                {onShuffle && <button className="jj-btn small ghost jj-shuffle" onClick={onShuffle}>Shuffle</button>}
            </div>
            <div className="jj-team-cols">
                {lobby.teams.map((ids, t) => (
                    <div key={t} className={`jj-team-col team-${t}`} style={{ '--tc': TEAMS[t].colour, '--td': TEAMS[t].deep } as any}>
                        <div className="jj-team-name">{TEAMS[t].name} <span>{ids.length}</span></div>
                        {ids.map(id => byId[id] && (
                            <button key={id} className="jj-team-chip" disabled={!onMove}
                                onClick={() => onMove && onMove(id, 1 - t)}>
                                <Avatar p={byId[id]} size={22} />
                                <span className="nm">{id === me ? 'You' : byId[id].name}</span>
                                {onMove && <i>{t === 0 ? '→' : '←'}</i>}
                            </button>
                        ))}
                        {ids.length < MIN_TEAM_SIZE && <div className="jj-team-short">needs {MIN_TEAM_SIZE - ids.length} more</div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const teamStyle = (t: number | null) => t == null ? undefined : ({ '--tc': TEAMS[t].colour, '--td': TEAMS[t].deep } as any);

/** Live scoreline: "Team Jibber 2 · 1 Team Jabber", your side marked. */
const TeamBanner: React.FC<{ jj: JJPublic }> = ({ jj }) => {
    if (!jj.teams) return null;
    return (
        <div className="jj-teambar">
            {jj.teams.map((t, i) => (
                <div key={i} className={['jj-teambar-side', i === jj.myTeam ? 'mine' : ''].join(' ')} style={teamStyle(i)}>
                    <span className="nm">{t.short}{i === jj.myTeam && <small>you</small>}</span>
                    <b className="sc">{fmtPts(t.score)}</b>
                </div>
            ))}
        </div>
    );
};

/** While your team plays: how far along the rival team is (no details). */
const RivalStatus: React.FC<{ jj: JJPublic }> = ({ jj }) => {
    const r = jj.rival;
    if (!r || !jj.teams) return null;
    const t = jj.teams[r.team];
    const text = r.status === Phase.Watch
        ? 'have guessed — waiting on you!'
        : r.status === Phase.Guess
            ? `are guessing…`
            : `clue ${Math.max(1, r.clueCount)} of ${r.cluesTarget} · ${r.letterCount} letter${r.letterCount === 1 ? '' : 's'}`;
    return (
        <div className={['jj-rival', r.status === Phase.Watch ? 'done' : ''].join(' ')} style={teamStyle(r.team)}>
            <span className="dot" />
            <b>{t.name}</b> <span>{text}</span>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Round track + player strip
// ---------------------------------------------------------------------------

const RoundTrack: React.FC<{ jj: JJPublic }> = ({ jj }) => (
    <div className="jj-track">
        {Array.from({ length: jj.rounds }, (_, i) => {
            const rec = jj.history[i];
            const cls = rec ? (rec.correct ? 'win' : 'miss') : (i + 1 === jj.round && jj.phase !== Phase.Done ? 'now' : '');
            return (
                <span key={i} className={`jj-pip ${cls}`} title={rec ? `${rec.word}` : `Round ${i + 1}`}>
                    {rec ? (rec.correct ? '✓' : '✗') : i + 1}
                </span>
            );
        })}
    </div>
);

interface Bubble { id: number; by: string; kind: SignalKind; }

const PlayerStrip: React.FC<{ jj: JJPublic; me: string; bubbles: Bubble[] }> = ({ jj, me, bubbles }) => {
    // Team mode: your team first, then a divider, then the rivals.
    const mine = jj.teamMode ? jj.players.filter(p => p.team === jj.myTeam) : jj.players;
    const rivals = jj.teamMode ? jj.players.filter(p => p.team !== jj.myTeam) : [];
    const picker = jj.choose ? jj.choose.pickerId : jj.chooserId;
    const seat = (p: JJPlayer, rival: boolean) => {
        const r = jj.rival;
        const isG = rival ? !!r && p.id === r.guesserId : p.id === jj.guesserId;
        const turn = rival ? !!r && r.spellerId === p.id : jj.phase === Phase.Spell && jj.spellerId === p.id;
        const picking = jj.phase === Phase.Choose && picker === p.id;
        const guessing = isG && (rival ? !!r && r.status === Phase.Guess : jj.phase === Phase.Guess);
        const b = [...bubbles].reverse().find(x => x.by === p.id);
        return (
                <div key={p.id} className={['jj-seat', turn ? 'turn' : '', isG ? 'guesser' : '', p.id === me ? 'me' : '', rival ? 'rival' : ''].join(' ')}
                    style={teamStyle(p.team)}>
                    {b && (isEmote(b.kind)
                        ? <span key={b.id} className="jj-bubble emote"><EmoteFace id={b.kind} size={34} /></span>
                        : <span key={b.id} className={`jj-bubble ${b.kind}`}>{b.kind === 'jibber' ? 'Jibber!' : 'Jabble?'}</span>)}
                    <Avatar p={p} size={42} />
                    {isG && <span className="jj-seat-badge guess">?</span>}
                    {turn && <span className="jj-seat-badge turn">▼</span>}
                    <span className="jj-seat-name">{p.id === me ? 'You' : p.name}</span>
                    <span className="jj-seat-role">
                        {isG ? (guessing ? 'guessing…' : 'Guesser') : picking ? 'picking…' : turn ? 'spelling' : ''}
                    </span>
                </div>
        );
    };
    return (
        <div className={['jj-strip', jj.teamMode ? 'teams' : ''].join(' ')}>
            {mine.map(p => seat(p, false))}
            {rivals.length > 0 && <span className="jj-strip-vs" style={teamStyle(jj.rival ? jj.rival.team : null)}>vs</span>}
            {rivals.map(p => seat(p, true))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Choose
// ---------------------------------------------------------------------------

const teamOf = (jj: JJPublic, id: string) => jj.players.find(p => p.id === id)?.team ?? null;

const ChooseStage: React.FC<{
    jj: JJPublic; my: JJPrivate; pick: number | null; onPick: (i: number) => void; onConfirm: () => void;
    onTier: (t: Tier) => void;
}> = ({ jj, my, pick, onPick, onConfirm, onTier }) => {
    const step = jj.choose ? jj.choose.step : 'any';
    const pickerId = jj.choose ? jj.choose.pickerId : jj.chooserId;
    const band = jj.choose ? jj.choose.tier : null;
    const chooser = my.me === pickerId;
    const pickerTeam = teamOf(jj, pickerId);
    const pickerLabel = <><b>{nameOf(jj, pickerId)}</b>{jj.teamMode && pickerTeam != null ? <> ({pickerTeam === jj.myTeam ? 'your team' : TEAMS[pickerTeam].name})</> : null}</>;
    const flipKey = `card-${jj.round}-${jj.cardId}`;
    const anim = fresh(my.me, flipKey) ? 'flip-in' : '';
    const bandPill = band && <TierPill tier={band} silly />;
    if (my.isGuesser || !my.cardWords) {
        return (
            <div className="jj-stage">
                <div className={`jj-cardback ${anim}`}>
                    <Blabbit mood="peek" size={96} colour="#ffe38f" />
                    <div className="jj-cardback-text">No peeking!</div>
                </div>
                <p className="jj-prompt">
                    You&rsquo;re the <b>Guesser</b>. {pickerLabel} is picking {step === 'tier' ? 'the difficulty' : 'your secret word'}…
                    {bandPill && <> Difficulty: {bandPill}</>}
                </p>
            </div>
        );
    }
    const showTip = jj.rounds === 6 && !jj.teamMode;
    const enabled = (i: number) => chooser && (step === 'any' || (step === 'word' && tierOf(i) === band));
    return (
        <div className="jj-stage">
            <p className="jj-prompt">
                {step === 'tier'
                    ? (chooser
                        ? <>Pick the <b>difficulty</b> — the other team then picks the word.</>
                        : <>{pickerLabel} is picking the difficulty…</>)
                    : step === 'word'
                        ? (chooser
                            ? <>Pick a {bandPill} word — both teams will spell it!</>
                            : <>{pickerLabel} is picking a {bandPill} word…</>)
                        : chooser
                            ? <>Pick the secret word for <b>{nameOf(jj, jj.guesserId)}</b>.</>
                            : <><b>{nameOf(jj, jj.chooserId)}</b> is picking a word for {nameOf(jj, jj.guesserId)}…</>}
            </p>
            {step === 'tier' && chooser && (
                <div className="jj-tier-pick">
                    {(['easy', 'medium', 'hard'] as Tier[]).map(t => (
                        <button key={t} className={`jj-tier-btn ${t}`} onClick={() => onTier(t)}>
                            <b>{TIER_LABEL[t]}</b><small>worth {TIER_POINTS[t]} pt{TIER_POINTS[t] > 1 ? 's' : ''}</small>
                        </button>
                    ))}
                </div>
            )}
            <div className={`jj-wordcard ${anim}`}>
                <div className="jj-wordcard-head">{jj.cardMode === 'mixed' ? 'Jumbled card' : 'Word card'} <span>#{jj.cardId}</span></div>
                {my.cardWords.map((w, i) => {
                    const tier = tierOf(i);
                    const outOfBand = step === 'word' && tier !== band;
                    return (
                        <button key={i}
                            className={['jj-wordrow', tier, pick === i ? 'picked' : '', (pick != null && pick !== i) || outOfBand ? 'faded' : ''].join(' ')}
                            disabled={!enabled(i)}
                            onClick={() => onPick(i)}>
                            <span className="num">{i + 1}</span>
                            <span className="word">{w}</span>
                            {pick === i && <span className="tick">✓</span>}
                        </button>
                    );
                })}
            </div>
            {chooser && step !== 'tier' && (
                <>
                    {showTip && (
                        <div className="jj-tier-row small">
                            <span className="jj-muted">Played so far:</span>
                            <TierPill tier="easy" num={undefined} /> {jj.tierCounts.easy}/2
                            <TierPill tier="medium" num={undefined} /> {jj.tierCounts.medium}/2
                            <TierPill tier="hard" num={undefined} /> {jj.tierCounts.hard}/2
                        </div>
                    )}
                    <button className="jj-btn primary big block" disabled={pick == null} onClick={onConfirm}>
                        Lock it in!
                    </button>
                </>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// The word panel (secret for spellers, mystery for the Guesser)
// ---------------------------------------------------------------------------

const WordPanel: React.FC<{ jj: JJPublic; my: JJPrivate }> = ({ jj, my }) => {
    if (jj.wordIdx == null) return null;
    const tier = tierOf(jj.wordIdx);
    if (my.isGuesser) {
        const len = jj.wordLength;
        return (
            <div className="jj-panel jj-mystery">
                <Blabbit mood={jj.phase === Phase.Guess ? 'shock' : 'confused'} size={58} colour="#9fd3f5" />
                <div className="jj-mystery-body">
                    <div className="jj-label">Your mystery word</div>
                    <TierPill tier={tier} num={jj.wordIdx + 1} silly />
                    {(len || jj.firstLetter) && (
                        <div className="jj-blanks" style={{ '--max': `${blockSizeFor(len || 6, 30)}px`, '--n': len || 2 } as any}>
                            {len
                                ? Array.from({ length: len }, (_, i) => (
                                    <LetterBlock key={i} ch={i === 0 && jj.firstLetter ? jj.firstLetter : '?'}
                                        colour={i === 0 && jj.firstLetter ? colourFor(0) : '#ece9f6'} ghost={!(i === 0 && jj.firstLetter)}
                                        tilt={tiltFor(i)} anim="pop" delay={i * 50} />
                                ))
                                : <><LetterBlock ch={jj.firstLetter!} colour={colourFor(0)} anim="pop" /><span className="jj-ellipsis">…</span></>}
                        </div>
                    )}
                </div>
            </div>
        );
    }
    const secret = my.secret || '';
    const key = `secret-${jj.round}-${jj.cardId}-${jj.wordIdx}`;
    const play = isNew(my.me, key);
    fresh(my.me, key);
    const current = jj.clues.length ? jj.clues[jj.clues.length - 1].letters.map(l => l.ch).join('') : '';
    const leak = jj.phase === Phase.Spell && current.length >= 3 && current.indexOf(normalise(secret)) !== -1;
    return (
        <div className="jj-panel jj-secret">
            <div className="jj-secret-head">
                <span className="jj-label">Secret word</span>
                <TierPill tier={tier} num={jj.wordIdx + 1} />
            </div>
            <ScrambleWord key={key} word={secret} size={blockSizeFor(secret.length, 36)} play={play} />
            {leak && <div className="jj-leak">Psst — that clue contains the secret word! That&rsquo;s against the rules.</div>}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Clue board
// ---------------------------------------------------------------------------

const ClueBoard: React.FC<{ jj: JJPublic; me: string; compact?: boolean; keyPrefix?: string }> = ({ jj, me, compact, keyPrefix = '' }) => {
    const players = playerMap(jj);
    const rows: (Clue | null)[] = [...jj.clues];
    const target = Math.max(jj.cluesTarget, rows.length);
    while (rows.length < target && (jj.phase === Phase.Spell || jj.phase === Phase.Choose)) rows.push(null);

    // Stagger only when several letters arrive at once (first render of a board).
    let batch = 0;
    const spellerAccent = jj.spellerId ? players[jj.spellerId]?.accent : '#c6b6f7';

    return (
        <div className={['jj-board', compact ? 'compact' : ''].join(' ')}>
            {rows.map((clue, i) => {
                if (!clue) {
                    return (
                        <div key={`ghost-${i}`} className="jj-clue-row ghost">
                            <div className="jj-clue-label">Clue {i + 1}</div>
                            <div className="jj-clue-blocks empty"><span>still to come…</span></div>
                        </div>
                    );
                }
                const isCurrent = jj.phase === Phase.Spell && i === jj.clues.length - 1;
                const len = clue.letters.length + (isCurrent ? 1 : 0);
                const size = blockSizeFor(Math.max(len, 3), compact ? 34 : 58);
                const stopKey = `${keyPrefix}stop-${jj.round}-${jj.cardId}-${i}`;
                const stopFresh = clue.stoppedBy ? fresh(me, stopKey) : null;
                return (
                    <div key={i} className={['jj-clue-row', isCurrent ? 'current' : '', clue.stoppedBy ? 'stopped' : '', clue.starred ? 'starred' : ''].join(' ')}>
                        <div className="jj-clue-label">
                            Clue {i + 1}
                            {clue.starred && <span className="jj-star" title="Highlighted">★</span>}
                        </div>
                        <div className="jj-clue-blocks" style={{ '--max': `${size}px`, '--n': Math.max(len, 3) } as any}>
                            {clue.letters.map((l, k) => {
                                const wasNew = isNew(me, l.id);
                                const f = fresh(me, l.id, wasNew ? (batch++) * 55 : 0);
                                const by = players[l.by];
                                return (
                                    <LetterBlock key={l.id} ch={l.ch} colour={colourFor(k, i * 2)} tilt={tiltFor(l.id)}
                                        anim={f ? 'drop' : 'none'} delay={f ? f.delay : 0}
                                        dot={by?.accent} title={by ? `${by.name}` : undefined} />
                                );
                            })}
                            {isCurrent && clue.letters.length < MAX_CLUE_LEN && (
                                <span className="jj-caret" style={{ '--a': spellerAccent } as any} />
                            )}
                            {clue.letters.length === 0 && !isCurrent && <span className="jj-muted">—</span>}
                        </div>
                        {clue.stoppedBy && (
                            <StopSign size={compact ? 26 : 34} className={stopFresh ? 'slam' : ''} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

const Keyboard: React.FC<{ onKey: (ch: string) => void; disabled?: boolean; tone?: 'stop' | '' }> = ({ onKey, disabled, tone }) => (
    <div className={['jj-keys', tone || ''].join(' ')}>
        {KEY_ROWS.map((row, r) => (
            <div key={r} className="jj-keyrow">
                {row.split('').map((ch, i) => (
                    <button key={ch} className="jj-key" disabled={disabled}
                        style={{ '--c': colourFor(i + r * 2) } as any}
                        onClick={() => { sfx.tap(); onKey(ch); }}>
                        {ch}
                    </button>
                ))}
            </div>
        ))}
    </div>
);

// ---------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------

const HintsPanel: React.FC<{
    jj: JJPublic; my: JJPrivate; picking: boolean; onPlay: () => void; onStar: (i: number) => void; onCancel: () => void;
}> = ({ jj, my, picking, onPlay, onStar, onCancel }) => {
    if (!jj.hintsEnabled) return null;
    const mine = jj.hints[my.me];
    const card = mine ? HINT_BY_ID[mine.hint] : null;
    const others = jj.players.filter(p => p.id !== my.me && jj.hints[p.id]);
    return (
        <div className="jj-panel jj-hints">
            <div className="jj-section-title">Hint cards <span className="jj-muted">once per game · you may discuss these</span></div>
            {card && (
                <div className={['jj-hintcard', mine!.used ? 'used' : '', my.hintUsable ? 'ready' : ''].join(' ')}>
                    <div className="glyph"><HintGlyph id={card.id} size={30} /></div>
                    <div className="body">
                        <b>{card.name}</b>
                        <span>{card.text}</span>
                    </div>
                    {mine!.used
                        ? <span className="jj-used-stamp">USED</span>
                        : <button className="jj-btn small primary" disabled={!my.hintUsable} onClick={onPlay}>Play</button>}
                </div>
            )}
            {picking && (
                <div className="jj-starpick">
                    <span>Star which clue?</span>
                    {jj.clues.map((c, i) => c.letters.length > 0 && !c.starred && (
                        <button key={i} className="jj-btn small" onClick={() => onStar(i)}>
                            {c.letters.map(l => l.ch).join('')}
                        </button>
                    ))}
                    <button className="jj-btn small ghost" onClick={onCancel}>Cancel</button>
                </div>
            )}
            {others.length > 0 && (
                <div className="jj-hint-others">
                    {others.map(p => {
                        const h = jj.hints[p.id];
                        const c = HINT_BY_ID[h.hint];
                        return (
                            <span key={p.id} className={['jj-hint-chip', h.used ? 'used' : ''].join(' ')} title={c.text}>
                                <Avatar p={p} size={20} />
                                <HintGlyph id={c.id} size={16} />
                                {c.name}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Scorebook
// ---------------------------------------------------------------------------

const Scorebook: React.FC<{ jj: JJPublic }> = ({ jj }) => {
    const rows = jj.teamMode ? jj.allHistory : jj.history;
    if (rows.length === 0) {
        return <div className="jj-root jj-scorebook"><p className="jj-muted center">No rounds finished yet. {nonsense(jj.round)}</p></div>;
    }
    return (
        <div className="jj-root jj-scorebook">
            {rows.map(h => (
                <div key={`${h.round}-${h.team}`} className={['jj-recap', h.correct ? 'win' : 'miss'].join(' ')}>
                    <div className="jj-recap-head">
                        <span className="rnd">R{h.round}</span>
                        {jj.teamMode && <span className="jj-team-tag" style={teamStyle(h.team)}>{TEAMS[h.team].short}</span>}
                        <b className="word">{h.word}</b>
                        <TierPill tier={tierOf(h.wordIdx)} num={h.wordIdx + 1} />
                        <span className="res">
                            {jj.teamMode
                                ? (h.correct ? <>+{fmtPts(h.points + h.bonus)}{h.bonus > 0 && <i className="jj-zap" title="Guessed first">⚡</i>}</> : '✗')
                                : h.correct ? (h.overruled ? 'allowed!' : '✓') : '✗'}
                        </span>
                    </div>
                    <div className="jj-recap-sub">
                        {nameOf(jj, h.guesserId)} guessed {h.guesses.length ? h.guesses.map(g => `“${g}”`).join(', ') : '—'}
                    </div>
                    <div className="jj-recap-clues">
                        {h.clues.map((c, i) => <span key={i} className="jj-clue-chip">{c || '—'}</span>)}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

interface MainState {
    pick: number | null;
    stopArmed: boolean;
    guess: string;
    starPicking: boolean;
    bubbles: Bubble[];
    signalCooldown: boolean;
    emoteCooldown: boolean;
}

export class JJMainPage extends React.Component<JJViewProps, MainState> {
    public state: MainState = { pick: null, stopArmed: false, guess: '', starPicking: false, bubbles: [], signalCooldown: false, emoteCooldown: false };
    private seenSignals = new Set<number>();
    private timers: any[] = [];

    private mp(): any { return this.props.MP; }

    // ---- lifecycle --------------------------------------------------------

    componentDidMount() {
        [...(this.props.jj?.signals || []), ...(this.props.jj?.emotes || [])].forEach(s => this.seenSignals.add(s.id));
        window.addEventListener('keydown', this.onKeyDown);
    }

    componentWillUnmount() {
        window.removeEventListener('keydown', this.onKeyDown);
        this.timers.forEach(t => clearTimeout(t));
    }

    private later(fn: () => void, ms: number) { this.timers.push(setTimeout(fn, ms)); }

    componentDidUpdate(prev: JJViewProps) {
        const a = prev.jj, b = this.props.jj;
        if (!a || !b) return;
        const me = this.props.my.me;

        // Reset UI-only state when the stage moves on.
        if (a.phase !== b.phase || a.round !== b.round || a.cardId !== b.cardId) {
            this.setState({ pick: null, stopArmed: false, starPicking: false, guess: b.phase === Phase.Guess ? this.state.guess : '' });
        } else if (a.spellerId !== b.spellerId && this.state.stopArmed) {
            this.setState({ stopArmed: false });
        }

        // ---- sound cues ----
        const lettersA = new Set<number>();
        a.clues.forEach(c => c.letters.forEach(l => lettersA.add(l.id)));
        const newLetters = b.clues.flatMap(c => c.letters).filter(l => !lettersA.has(l.id));
        const countA = a.clues.reduce((n, c) => n + c.letters.length, 0);
        const countB = b.clues.reduce((n, c) => n + c.letters.length, 0);
        const stopsA = a.clues.filter(c => c.stoppedBy).length;
        const stopsB = b.clues.filter(c => c.stoppedBy).length;

        if (b.phase === Phase.Done && a.phase !== Phase.Done) {
            sfx.finale(b.rank.idx >= 2);
        } else if (b.phase === Phase.Watch && a.phase !== Phase.Watch) {
            // our team just guessed; the rival team is still going
            this.later(() => (b.correct ? sfx.fanfare() : sfx.wahwah()), 300);
        } else if (b.phase === Phase.Reveal && a.phase === Phase.Watch) {
            sfx.flip();
            const r = b.rival;
            if (r && r.correct != null) this.later(() => (r.correct ? sfx.fanfare() : sfx.wahwah()), 350);
        } else if (b.phase === Phase.Reveal && a.phase !== Phase.Reveal) {
            if (stopsB > stopsA) sfx.stop();
            this.later(() => (b.correct ? sfx.fanfare() : sfx.wahwah()), stopsB > stopsA ? 450 : 350);
        } else if (b.phase === Phase.Choose && (a.phase !== Phase.Choose || a.cardId !== b.cardId)) {
            sfx.flip();
        } else if (b.phase === Phase.Spell && a.phase === Phase.Choose) {
            sfx.select();
        } else if (b.phase === Phase.Guess && a.phase !== Phase.Guess) {
            sfx.stop();
            this.later(() => sfx.drumroll(), 500);
        } else {
            if (stopsB > stopsA) {
                sfx.stop();
                if (newLetters.length) this.later(() => sfx.plonk(newLetters[newLetters.length - 1].ch), 380);
            } else if (newLetters.length) {
                sfx.plonk(newLetters[newLetters.length - 1].ch);
            } else if (countB < countA) {
                sfx.erase();
            }
        }
        if (b.phase === Phase.Guess && a.phase === Phase.Guess && b.guesses.length > a.guesses.length) sfx.buzz();
        // Spectating: the rival team's letters land with the same bloop.
        if (b.phase === Phase.Watch && a.phase === Phase.Watch && a.rival?.clues && b.rival?.clues) {
            const seen = new Set<number>();
            a.rival.clues.forEach(c => c.letters.forEach(l => seen.add(l.id)));
            const fresh = b.rival.clues.flatMap(c => c.letters).filter(l => !seen.has(l.id));
            const rs = (x: JJRival) => (x.clues || []).filter(c => c.stoppedBy).length;
            if (rs(b.rival) > rs(a.rival)) sfx.stop();
            else if (fresh.length) sfx.plonk(fresh[fresh.length - 1].ch);
            if (b.rival.status === Phase.Guess && a.rival.status !== Phase.Guess) this.later(() => sfx.drumroll(), 400);
        }
        if (b.overruled && !a.overruled) sfx.fanfare();
        if (b.lastEvent && b.lastEvent.id !== a.lastEvent?.id && b.lastEvent.kind !== 'overrule') sfx.sparkle();
        if (b.spellerId === me && a.spellerId !== me && b.phase === Phase.Spell) this.later(() => sfx.turn(), 420);

        // ---- speech bubbles ----
        const newSignals: Signal[] = [...(b.signals || []), ...(b.emotes || [])]
            .filter(s => !this.seenSignals.has(s.id))
            .sort((x, y) => x.id - y.id);
        if (newSignals.length) {
            newSignals.forEach(s => this.seenSignals.add(s.id));
            const last = newSignals[newSignals.length - 1];
            if (last.kind === 'jibber') sfx.jibber();
            else if (last.kind === 'jabble') sfx.jabble();
            else sfx.emote(last.kind);
            this.setState(st => ({ bubbles: [...st.bubbles, ...newSignals.map(s => ({ id: s.id, by: s.by, kind: s.kind }))].slice(-8) }));
            newSignals.forEach(s => this.later(() => this.setState(st => ({ bubbles: st.bubbles.filter(x => x.id !== s.id) })), 2600));
        }
    }

    // ---- input ------------------------------------------------------------

    private onKeyDown = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const { jj, my } = this.props;
        if (!jj || jj.phase !== Phase.Spell || jj.spellerId !== my.me) return;
        const k = e.key;
        if (/^[a-zA-Z]$/.test(k)) {
            e.preventDefault();
            this.letter(k.toUpperCase());
        } else if (k === 'Enter' || k === '.') {
            e.preventDefault();
            if (this.state.stopArmed && this.isLastClue()) this.confirmStop();
            else this.armStop();
        } else if (k === 'Escape') {
            this.setState({ stopArmed: false });
        }
    };

    private isLastClue() { const jj = this.props.jj; return jj.clues.length >= jj.cluesTarget; }
    private currentLen() { const c = this.props.jj.clues; return c.length ? c[c.length - 1].letters.length : 0; }

    private letter = (ch: string) => {
        if (this.state.stopArmed) {
            if (this.isLastClue()) return;
            this.setState({ stopArmed: false });
            this.mp().stopClue(ch);
        } else {
            if (this.currentLen() >= MAX_CLUE_LEN) return;
            this.mp().addLetter(ch);
        }
    };

    private armStop = () => {
        if (this.currentLen() === 0) return;
        this.setState({ stopArmed: true });
    };

    private confirmStop = () => {
        this.setState({ stopArmed: false });
        this.mp().stopClue();
    };

    private sendSignal(kind: 'jibber' | 'jabble') {
        if (this.state.signalCooldown) return;
        this.mp().signal(kind);
        this.setState({ signalCooldown: true });
        this.later(() => this.setState({ signalCooldown: false }), 1200);
    }

    private sendEmote(id: EmoteId) {
        if (this.state.emoteCooldown) return;
        this.mp().signal(id);
        this.setState({ emoteCooldown: true });
        this.later(() => this.setState({ emoteCooldown: false }), 700);
    }

    private submitGuess = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const g = normalise(this.state.guess);
        if (!g) return;
        this.setState({ guess: '' });
        this.mp().submitGuess(g);
    };

    private playHint = () => {
        const { jj, my } = this.props;
        const h = jj.hints[my.me];
        if (!h) return;
        if (h.hint === 'highlighter') {
            const options = jj.clues.map((c, i) => ({ c, i })).filter(x => x.c.letters.length > 0 && !x.c.starred);
            if (options.length === 1) this.mp().useHint(options[0].i);
            else this.setState({ starPicking: true });
            return;
        }
        this.mp().useHint();
    };

    // ---- stages -----------------------------------------------------------

    /** The row of faces. Everybody (both teams) sees whatever you send. */
    private renderEmotes() {
        return (
            <div className="jj-emotes" role="group" aria-label="How do you feel?">
                {EMOTES.map(e => (
                    <button key={e.id} className="jj-emote-btn" title={e.label} aria-label={e.label}
                        disabled={this.state.emoteCooldown} onClick={() => this.sendEmote(e.id)}>
                        <EmoteFace id={e.id} size={40} />
                    </button>
                ))}
            </div>
        );
    }

    /** A synthetic lane view of the rival team, so the normal board can draw it. */
    private rivalJJ(): JJPublic | null {
        const { jj } = this.props;
        const r = jj.rival;
        if (!r || !r.visible || !r.clues) return null;
        return {
            ...jj,
            phase: r.status === Phase.Watch ? Phase.Reveal : r.status,
            clues: r.clues,
            spellerId: r.spellerId,
            cluesTarget: r.cluesTarget,
            guesserId: r.guesserId
        };
    }

    /** One team's result: stamp, their final guess, tick or cross. */
    private resultCard(team: number | null, guess: string, correct: boolean, overruled: boolean, guesserId: string, animKey: string) {
        const { jj, my } = this.props;
        const f = fresh(my.me, animKey);
        const stamp = correct ? (overruled ? 'WE’LL ALLOW IT!' : 'JIBBERIFIC!') : 'JABBLED!';
        const rec = team == null ? null : jj.allHistory.find(h => h.round === jj.round && h.team === team);
        return (
            <div className={['jj-result', correct ? 'win' : 'miss'].join(' ')} style={teamStyle(team)}>
                {team != null && <div className="jj-result-team">{team === jj.myTeam ? 'Your team' : TEAMS[team].name}</div>}
                <div className={['jj-stamp small', f ? 'slam' : ''].join(' ')}>{stamp}</div>
                <div className="jj-label">{guesserId === my.me ? 'You guessed' : `${nameOf(jj, guesserId)} guessed`}</div>
                <div className={correct ? '' : 'jj-wobble'}>
                    <BlockWord word={guess || '—'} size={blockSizeFor(Math.max(guess.length, 1), 34)} anim={f ? 'drop' : 'none'} offset={team || 0} />
                </div>
                {rec && correct && (
                    <div className="jj-points">
                        <span className={['jj-pts', f ? 'pop' : ''].join(' ')}>+{fmtPts(rec.points)}</span>
                        {rec.bonus > 0 && <span className={['jj-pts bonus', f ? 'pop' : ''].join(' ')}>⚡ first +{fmtPts(rec.bonus)}</span>}
                    </div>
                )}
            </div>
        );
    }

    /** Team mode: our guess is in; watch the rival team finish. */
    private renderWatch() {
        const { jj, my } = this.props;
        const secret = my.secret || '';
        const rj = this.rivalJJ();
        const r = jj.rival;
        const lastGuess = jj.guesses[jj.guesses.length - 1] || '';
        return (
            <div className="jj-stage">
                {jj.correct && fresh(my.me, `watch-confetti-${jj.round}`) && <Confetti />}
                {this.resultCard(jj.myTeam, lastGuess, jj.correct, jj.overruled, jj.guesserId, `watch-${jj.round}`)}
                <div className="jj-label center">The word is</div>
                <BlockWord word={secret} size={blockSizeFor(secret.length, 40)} anim="none" />
                {r && jj.teams && (
                    <div className="jj-spectate" style={teamStyle(r.team)}>
                        <div className="jj-spectate-head">
                            <span className="eye">👀</span> Spectating <b>{jj.teams[r.team].name}</b>
                            <span className="jj-muted">{r.status === Phase.Guess ? 'guessing…' : `clue ${Math.max(1, r.clueCount)} of ${r.cluesTarget}`}</span>
                        </div>
                        {rj && <ClueBoard jj={rj} me={my.me} compact keyPrefix="rival-" />}
                        {r.status === Phase.Guess && (
                            <div className="jj-waitline">
                                <b>{nameOf(jj, r.guesserId)}</b> is guessing<span className="jj-dots"><i>.</i><i>.</i><i>.</i></span>
                                {r.guesses && r.guesses.length > 0 && <span className="jj-muted"> tried {r.guesses.join(', ')}</span>}
                            </div>
                        )}
                    </div>
                )}
                {this.renderEmotes()}
            </div>
        );
    }

    /** Team mode reveal: both results side by side. */
    private renderTeamReveal() {
        const { jj, my } = this.props;
        const r = jj.rival!;
        const secret = my.secret || '';
        const finalRound = jj.round >= jj.rounds;
        const mine = { team: jj.myTeam!, guess: jj.guesses[jj.guesses.length - 1] || '', correct: jj.correct, overruled: jj.overruled, guesserId: jj.guesserId };
        const theirs = { team: r.team, guess: (r.guesses || [])[(r.guesses || []).length - 1] || '', correct: !!r.correct, overruled: r.overruled, guesserId: r.guesserId };
        const sides = [mine, theirs].sort((x, y) => x.team - y.team);
        const f = fresh(my.me, `reveal-teams-${jj.round}`);
        return (
            <div className="jj-stage jj-reveal">
                {(mine.correct || theirs.correct) && f && <Confetti />}
                <div className="jj-label">The word was</div>
                <BlockWord word={secret} size={blockSizeFor(secret.length, 52)} anim={f ? 'flip' : 'none'} stagger={110} />
                {jj.wordIdx != null && <div className="center"><TierPill tier={tierOf(jj.wordIdx)} num={jj.wordIdx + 1} silly /></div>}
                <div className="jj-result-pair">
                    {sides.map(s => <React.Fragment key={s.team}>{this.resultCard(s.team, s.guess, s.correct, s.overruled, s.guesserId, `rv-${jj.round}-${s.team}-${s.correct}`)}</React.Fragment>)}
                </div>
                <div className="jj-row center">
                    {!theirs.correct && theirs.guess && (
                        <button className="jj-btn" title={`Count ${TEAMS[r.team].name}’s near-miss`} onClick={() => this.mp().allowGuess()}>
                            We&rsquo;ll allow theirs!
                        </button>
                    )}
                    <button className="jj-btn primary big" onClick={() => this.mp().nextRound()}>
                        {finalRound ? 'Final score →' : 'Next round →'}
                    </button>
                </div>
                {this.renderEmotes()}
            </div>
        );
    }

    private renderTeamDone() {
        const { jj, my } = this.props;
        const teams = jj.teams!;
        const f = fresh(my.me, 'done-teams-' + jj.allHistory.length);
        const won = jj.winner != null && jj.winner === jj.myTeam;
        return (
            <div className="jj-stage jj-done">
                {won && f && <Confetti count={48} />}
                <Blabbit mood={jj.winner == null ? 'happy' : won ? 'party' : 'shock'} size={92}
                    colour={jj.winner == null ? '#c6b6f7' : TEAMS[jj.winner].colour} />
                <div className="jj-label">Final score</div>
                <div className="jj-final-teams">
                    {teams.map((t, i) => (
                        <div key={i} className={['jj-final-side', jj.winner === i ? 'winner' : ''].join(' ')} style={teamStyle(i)}>
                            <div className="nm">{t.name}{i === jj.myTeam && <small> (you)</small>}</div>
                            <BlockWord word={fmtPts(t.score)} size={60} anim={f ? 'drop' : 'none'} offset={i * 3} />
                        </div>
                    ))}
                </div>
                <div className="jj-rank r2" style={jj.winner != null ? { background: TEAMS[jj.winner].colour } : undefined}>
                    {jj.winner == null ? 'A jumbled tie!' : `${TEAMS[jj.winner].name} wins!`}
                </div>
                {my.isHost
                    ? (
                        <div className="jj-row center">
                            <button className="jj-btn primary big" onClick={() => this.mp().restartGame()}>Rematch</button>
                            <button className="jj-btn ghost" onClick={() => this.mp().backToLobby()}>Back to lobby</button>
                        </div>
                    )
                    : <p className="jj-muted center">The host can start a rematch.</p>}
                <Scorebook jj={jj} />
            </div>
        );
    }

    private renderSpellControls() {
        const { jj, my } = this.props;
        const players = playerMap(jj);
        const myTurn = jj.spellerId === my.me;
        const signals = (
            <div className="jj-signals">
                <button className="jj-say jibber" disabled={this.state.signalCooldown} onClick={() => this.sendSignal('jibber')}>
                    Jibber!<small>I get it</small>
                </button>
                <button className="jj-say jabble" disabled={this.state.signalCooldown} onClick={() => this.sendSignal('jabble')}>
                    Jabble?<small>I&rsquo;m lost</small>
                </button>
            </div>
        );
        const emotes = this.renderEmotes();

        if (!myTurn) {
            const who = jj.spellerId ? players[jj.spellerId] : null;
            return (
                <>
                    <div className="jj-waitline">
                        {who && <Avatar p={who} size={26} />}
                        <span>{my.isGuesser
                            ? <>Watch the letters drop… <b>{who?.name}</b> is up.</>
                            : <><b>{who?.name}</b> is adding a letter. <span className="jj-muted">{nonsense(jj.clues.length + jj.round)}</span></>}
                        </span>
                    </div>
                    {signals}
                    {emotes}
                </>
            );
        }

        const last = this.isLastClue();
        const clueNo = jj.clues.length;
        const canStop = this.currentLen() > 0;
        const full = this.currentLen() >= MAX_CLUE_LEN;

        if (this.state.stopArmed) {
            return (
                <div className="jj-controls armed">
                    {last
                        ? (
                            <>
                                <div className="jj-prompt big">Stop clue {clueNo} and hand over to the Guesser?</div>
                                <div className="jj-row">
                                    <button className="jj-stop-btn" onClick={this.confirmStop}><StopSign size={56} label="STOP!" /> <span>Yes — guess time!</span></button>
                                    <button className="jj-btn ghost" onClick={() => this.setState({ stopArmed: false })}>Keep spelling</button>
                                </div>
                            </>
                        )
                        : (
                            <>
                                <div className="jj-prompt big"><StopSign size={30} label="STOP" /> Now tap the <b>first letter of clue {clueNo + 1}</b>.</div>
                                <Keyboard onKey={this.letter} tone="stop" />
                                <button className="jj-btn ghost block" onClick={() => this.setState({ stopArmed: false })}>Oops — keep this clue going</button>
                            </>
                        )}
                    {signals}
                    {emotes}
                </div>
            );
        }

        return (
            <div className="jj-controls mine">
                <div className="jj-prompt big">
                    {full ? 'This clue is full — time to STOP!'
                        : jj.lettersLeft > 1 ? <>Double Up! Add <b>{jj.lettersLeft}</b> more letters.</>
                            : <>Your turn! Add <b>one letter</b>{canStop ? ', or STOP this clue' : ''}.</>}
                </div>
                <Keyboard onKey={this.letter} disabled={full} />
                <button className="jj-stop-btn wide" disabled={!canStop} onClick={this.armStop}>
                    <StopSign size={46} label="STOP" />
                    <span>{last ? 'Stop & let them guess' : `Stop — start clue ${clueNo + 1}`}</span>
                </button>
                {signals}
                {emotes}
            </div>
        );
    }

    private renderGuess() {
        const { jj, my } = this.props;
        if (!my.isGuesser) {
            return (
                <div className="jj-panel jj-thinking">
                    <Blabbit mood="confused" size={56} colour="#ffe38f" />
                    <div><b>{nameOf(jj, jj.guesserId)}</b> is guessing<span className="jj-dots"><i>.</i><i>.</i><i>.</i></span>
                        {jj.guesses.length > 0 && <div className="jj-muted">Tried: {jj.guesses.join(', ')} — {jj.guessesLeft} left</div>}
                    </div>
                </div>
            );
        }
        const g = normalise(this.state.guess);
        return (
            <form className="jj-panel jj-guessbox" onSubmit={this.submitGuess}>
                <div className="jj-prompt big">
                    {jj.guessesLeft > 1 ? <>You have <b>{jj.guessesLeft}</b> guesses.</> : <>One guess. Make it count!</>}
                </div>
                {jj.guesses.length > 0 && (
                    <div className="jj-tried">{jj.guesses.map((x, i) => <s key={i}>{x}</s>)}</div>
                )}
                <div className="jj-guess-preview" style={{ '--max': `${blockSizeFor(Math.max(g.length, 4), 52)}px`, '--n': Math.max(g.length, 4) } as any}>
                    {g.length
                        ? g.split('').map((ch, i) => <LetterBlock key={`${i}-${ch}`} ch={ch} colour={colourFor(i, 1)} tilt={tiltFor(i)} anim="pop" />)
                        : <span className="jj-muted">type your guess…</span>}
                </div>
                <input className="jj-input" autoFocus value={this.state.guess} maxLength={24}
                    placeholder="Your guess" autoCapitalize="characters" autoComplete="off" spellCheck={false}
                    onChange={(e) => { this.setState({ guess: e.target.value }); sfx.tap(); }} />
                <button className="jj-btn primary big block" type="submit" disabled={!g}>Guess!</button>
            </form>
        );
    }

    private renderReveal() {
        const { jj, my } = this.props;
        const secret = my.secret || '';
        const last = jj.guesses[jj.guesses.length - 1] || '';
        const finalRound = jj.round >= jj.rounds;
        const stamp = jj.correct ? (jj.overruled ? 'WE’LL ALLOW IT!' : 'JIBBERIFIC!') : 'JABBLED!';
        const key = `reveal-${jj.round}-${jj.correct}`;
        const f = fresh(my.me, key);
        return (
            <div className={['jj-stage jj-reveal', jj.correct ? 'win' : 'miss'].join(' ')}>
                {jj.correct && f && <Confetti />}
                <div className="jj-reveal-top">
                    <Blabbit mood={jj.correct ? 'party' : 'shock'} size={78} colour={jj.correct ? '#a8e6c4' : '#ff9aa2'} />
                    <div className={['jj-stamp', f ? 'slam' : ''].join(' ')}>{stamp}</div>
                </div>
                <div className="jj-label">{my.isGuesser ? 'You guessed' : `${nameOf(jj, jj.guesserId)} guessed`}</div>
                <div className={jj.correct ? '' : 'jj-wobble'}>
                    <BlockWord word={last} size={blockSizeFor(last.length, 46)} anim={f ? 'drop' : 'none'} offset={1} />
                </div>
                <div className="jj-label">The word was</div>
                <BlockWord word={secret} size={blockSizeFor(secret.length, 52)} anim={f ? 'flip' : 'none'} stagger={110} />
                {jj.wordIdx != null && <div className="center"><TierPill tier={tierOf(jj.wordIdx)} num={jj.wordIdx + 1} silly /></div>}
                <div className="jj-row center">
                    {!jj.correct && !my.isGuesser && (
                        <button className="jj-btn" onClick={() => this.mp().allowGuess()}>We&rsquo;ll allow it!</button>
                    )}
                    <button className="jj-btn primary big" onClick={() => this.mp().nextRound()}>
                        {finalRound ? 'Final score →' : 'Next round →'}
                    </button>
                </div>
                {!finalRound && <p className="jj-muted center">Next Guesser: <b>{nameOf(jj, jj.chooserId)}</b></p>}
            </div>
        );
    }

    private renderDone() {
        const { jj, my } = this.props;
        const good = jj.rank.idx >= 2;
        const f = fresh(my.me, 'done-' + jj.history.length);
        return (
            <div className="jj-stage jj-done">
                {good && f && <Confetti count={48} />}
                <Blabbit mood={good ? 'party' : jj.rank.idx === 1 ? 'happy' : 'confused'} size={92} colour="#c6b6f7" />
                <div className="jj-label">Final score</div>
                <BlockWord word={`${jj.score}/${jj.rounds}`} size={64} anim={f ? 'drop' : 'none'} stagger={140} />
                <div className={['jj-rank', `r${jj.rank.idx}`].join(' ')}>{jj.rank.title}</div>
                <div className="jj-panel">
                    <div className="jj-section-title">Challenges</div>
                    <div className="jj-badges">
                        {CHALLENGES.map(c => {
                            const got = jj.challenges[c.id];
                            return (
                                <div key={c.id} className={['jj-badge', got ? 'got' : '', c.auto ? '' : 'honour'].join(' ')} title={c.text}>
                                    <span className="medal">{got ? '★' : c.auto ? '☆' : '?'}</span>
                                    <b>{c.name}</b>
                                    <small>{c.text}</small>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {my.isHost
                    ? (
                        <div className="jj-row center">
                            <button className="jj-btn primary big" onClick={() => this.mp().restartGame()}>Play again</button>
                            <button className="jj-btn ghost" onClick={() => this.mp().backToLobby()}>Back to lobby</button>
                        </div>
                    )
                    : <p className="jj-muted center">The host can start another game.</p>}
                <Scorebook jj={jj} />
            </div>
        );
    }

    private renderHome() {
        const { jj, my } = this.props;
        let stage: React.ReactNode = null;
        switch (jj.phase) {
            case Phase.Choose:
                stage = (
                    <>
                        <ChooseStage jj={jj} my={my} pick={this.state.pick}
                            onPick={(i) => { sfx.tap(); this.setState({ pick: i }); }}
                            onConfirm={() => { if (this.state.pick != null) this.mp().chooseWord(this.state.pick); }}
                            onTier={(t) => { sfx.select(); this.mp().chooseTier(t); }} />
                        {this.renderEmotes()}
                    </>
                );
                break;
            case Phase.Watch:
                stage = this.renderWatch();
                break;
            case Phase.Spell:
                stage = (
                    <div className="jj-stage">
                        <WordPanel jj={jj} my={my} />
                        <ClueBoard jj={jj} me={my.me} />
                        {this.renderSpellControls()}
                    </div>
                );
                break;
            case Phase.Guess:
                stage = (
                    <div className="jj-stage">
                        <WordPanel jj={jj} my={my} />
                        <ClueBoard jj={jj} me={my.me} />
                        {this.renderGuess()}
                        {!my.isGuesser && this.renderEmotes()}
                    </div>
                );
                break;
            case Phase.Reveal: {
                const rj = this.rivalJJ();
                stage = jj.teamMode
                    ? (
                        <div className="jj-stage">
                            {this.renderTeamReveal()}
                            <div className="jj-board-pair">
                                <div className="jj-board-side" style={teamStyle(jj.myTeam)}>
                                    <div className="jj-board-title">Your team&rsquo;s clues</div>
                                    <ClueBoard jj={jj} me={my.me} compact />
                                </div>
                                {rj && jj.rival && (
                                    <div className="jj-board-side" style={teamStyle(jj.rival.team)}>
                                        <div className="jj-board-title">{TEAMS[jj.rival.team].name}&rsquo;s clues</div>
                                        <ClueBoard jj={rj} me={my.me} compact keyPrefix="rival-" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                    : (
                        <div className="jj-stage">
                            {this.renderReveal()}
                            <ClueBoard jj={jj} me={my.me} compact />
                            {this.renderEmotes()}
                        </div>
                    );
                break;
            }
            case Phase.Done:
                stage = jj.teamMode ? this.renderTeamDone() : this.renderDone();
                break;
        }
        return (
            <div className="jj-root jj-play">
                <Backdrop />
                {jj.teamMode && <TeamBanner jj={jj} />}
                {jj.phase !== Phase.Done && <RoundTrack jj={jj} />}
                {jj.phase !== Phase.Done && <PlayerStrip jj={jj} me={my.me} bubbles={this.state.bubbles} />}
                {jj.teamMode && (jj.phase === Phase.Spell || jj.phase === Phase.Guess) && <RivalStatus jj={jj} />}
                {stage}
                {jj.phase !== Phase.Done && jj.phase !== Phase.Reveal && (
                    <HintsPanel jj={jj} my={my} picking={this.state.starPicking}
                        onPlay={this.playHint}
                        onStar={(i) => { this.setState({ starPicking: false }); this.mp().useHint(i); }}
                        onCancel={() => this.setState({ starPicking: false })} />
                )}
            </div>
        );
    }

    /** Just the sound switch — round, score and teams already live on the page. */
    private topBar() {
        return (
            <span className="jj-topbar">
                <MuteToggle />
            </span>
        );
    }

    public render() {
        const { jj, my } = this.props;
        const mp = this.props.MP;
        if (!jj || !my) return null;

        const needsMe = (jj.phase === Phase.Choose && (jj.choose ? jj.choose.pickerId : jj.chooserId) === my.me)
            || (jj.phase === Phase.Spell && jj.spellerId === my.me)
            || (jj.phase === Phase.Guess && my.isGuesser);

        const links: any = {
            'home': { 'icon': 'quote-left', 'label': 'Play', 'view': this.renderHome() },
            'scores': { 'icon': 'scroll', 'label': 'Scorebook', 'view': <Scorebook jj={jj} /> },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        if (my.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Settings',
                'view': (
                    <div className="jj-root jj-settings">
                        <button className="jj-btn" onClick={() => this.mp().restartGame()}>Restart game</button>
                        <button className="jj-btn ghost" onClick={() => this.mp().backToLobby()}>Back to lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Jibber Jabble',
            'topBarContent': this.topBar(),
            'roomClassName': needsMe ? 'attention-bg' : ''
        });
    }
}
