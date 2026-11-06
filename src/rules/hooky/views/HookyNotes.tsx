/**
 * HookyNotes.tsx — the private deduction sheet and the public question log.
 *
 * Sheet: letters × (each opponent + Hooky). Tapping a cell cycles it
 * blank → ✓ has it → ✗ not it → ? maybe → blank. First-level facts are filled in
 * automatically and locked: your own hand, face-up cards, Playground cards and
 * your peeks (✓ for the owner, ✗ everywhere else). Anything deduced beyond that
 * is up to the player.
 *
 * Notes live in the main page's state and are mirrored to localStorage per game
 * and client, so a reload or tab switch keeps them.
 */

import * as React from 'react';
import { LETTERS, STUDENTS, HOOKY_COUNT, WORD_LEN } from '../HookyData';
import { Phase, LogEntry } from '../HookyGameState';
import { HKPublic, HKPrivate, HKPlayer } from '../HookyTypes';
import { Avatar, BellGlyph, SlideGlyph, StudentCard, Tile, TileWord, Stamp, TileMark, fresh } from './HookyBits';

export type Mark = 'yes' | 'no' | 'maybe';
/** Tap order for a sheet cell: blank → ✓ → ✗ → ? → blank. */
export function nextMark(m: Mark | null | undefined): Mark | null {
    return !m ? 'yes' : m === 'yes' ? 'no' : m === 'no' ? 'maybe' : null;
}
export type Notes = Record<string, Mark>;

export const HOOKY_COL = 'hooky';
export const cellKey = (letter: string, col: string) => `${letter}|${col}`;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const storeKey = (gameId: number, me: string) => `hooky_notes_${gameId}_${me}`;

export function loadNotes(gameId: number, me: string): Notes {
    try {
        const raw = localStorage.getItem(storeKey(gameId, me));
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

export function saveNotes(gameId: number, me: string, notes: Notes) {
    try { localStorage.setItem(storeKey(gameId, me), JSON.stringify(notes)); } catch (e) { /* storage blocked */ }
}

// ---------------------------------------------------------------------------
// First-level knowledge
// ---------------------------------------------------------------------------

/** letter → who certainly has it: 'me', a player id, or 'pg' (Playground). */
export function knownOwners(hk: HKPublic, my: HKPrivate): Record<string, string> {
    const o: Record<string, string> = {};
    hk.playground.forEach(l => { o[l] = 'pg'; });
    hk.players.forEach(p => p.revealed.forEach(l => { o[l] = p.id === my.me ? 'me' : p.id; }));
    my.peeks.forEach(pk => { o[pk.letter] = pk.target; });
    my.hand.forEach(l => { o[l] = 'me'; });
    return o;
}

export function autoMark(owners: Record<string, string>, letter: string, col: string): Mark | null {
    const owner = owners[letter];
    if (!owner) return null;
    return owner === col ? 'yes' : 'no';
}

export function effectiveMark(notes: Notes, owners: Record<string, string>, letter: string, col: string): Mark | null {
    return autoMark(owners, letter, col) || notes[cellKey(letter, col)] || null;
}

export const opponentsOf = (hk: HKPublic, me: string) => hk.players.filter(p => p.id !== me);

/** Tile marks for a word as seen against `target`'s column. */
export function wordMarks(word: string, target: string, notes: Notes, owners: Record<string, string>, me: string, hand: string[]): TileMark[] {
    return word.split('').map(ch => {
        if (target === me) return hand.indexOf(ch) !== -1 ? 'mine' : 'no';
        return effectiveMark(notes, owners, ch, target);
    });
}

// ---------------------------------------------------------------------------
// Contradictions
// ---------------------------------------------------------------------------

export interface SheetIssues {
    /** 'multi': ✓ in more than one column; 'none': ✗ everywhere with nowhere left for it. */
    rows: Record<string, 'multi' | 'none'>;
    /** ✗ everywhere, but a face-down Playground card could still be it: a hint, not an error. */
    recess: string[];
    /** 'over': more ✓ than the hand holds; 'under': too few squares left without ✗. */
    cols: Record<string, 'over' | 'under'>;
    messages: string[];
}

/**
 * Checks your marks against the hard facts of the deal: each student is in
 * exactly one place (a hand, Hooky, or the Playground), each hand holds exactly
 * `setup.hand` students and Hooky exactly 3. Only reports clashes; it never
 * fills anything in.
 */
export function sheetIssues(hk: HKPublic, my: HKPrivate, notes: Notes): SheetIssues {
    const owners = knownOwners(hk, my);
    const cols = [
        ...opponentsOf(hk, my.me).map(p => ({ id: p.id, name: p.name, cap: hk.setup.hand })),
        { id: HOOKY_COL, name: 'Hooky', cap: HOOKY_COUNT }
    ];
    const out: SheetIssues = { rows: {}, recess: [], cols: {}, messages: [] };

    const crossed: string[] = [];
    LETTERS.forEach(l => {
        if (owners[l]) return;                       // certain already; auto marks can't clash
        const ms = cols.map(c => effectiveMark(notes, owners, l, c.id));
        const yes = ms.filter(m => m === 'yes').length;
        if (yes > 1) {
            out.rows[l] = 'multi';
            out.messages.push(`${l} is ticked in ${yes} places`);
        } else if (ms.every(m => m === 'no')) {
            crossed.push(l);
        }
    });
    // A letter crossed off everywhere must be a face-down Playground card.
    if (crossed.length > hk.playgroundHidden) {
        crossed.forEach(l => { out.rows[l] = 'none'; });
        out.messages.push(hk.playgroundHidden === 0
            ? `${crossed.join(', ')} ${crossed.length === 1 ? 'is' : 'are'} crossed off everywhere`
            : `${crossed.join(', ')} are crossed off everywhere, but only ${hk.playgroundHidden} Playground card${hk.playgroundHidden === 1 ? ' is' : 's are'} still face down`);
    } else {
        out.recess = crossed;
    }

    cols.forEach(c => {
        const ms = LETTERS.map(l => effectiveMark(notes, owners, l, c.id));
        const yes = ms.filter(m => m === 'yes').length;
        const open = ms.filter(m => m !== 'no').length;
        if (yes > c.cap) {
            out.cols[c.id] = 'over';
            out.messages.push(`${c.name} has ${yes} ✓ but ${c.id === HOOKY_COL ? 'only 3 are skipping' : `holds ${c.cap}`}`);
        } else if (open < c.cap) {
            out.cols[c.id] = 'under';
            out.messages.push(`${c.name} has only ${open} square${open === 1 ? '' : 's'} not crossed off but ${c.id === HOOKY_COL ? 'needs 3' : `holds ${c.cap}`}`);
        }
    });
    return out;
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

const MarkGlyph: React.FC<{ m: Mark | null }> = ({ m }) => {
    if (m === 'yes') return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 10.5 l4 4 l8 -9" stroke="currentColor" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    if (m === 'no') return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M5 5 l10 10 M15 5 l-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
    if (m === 'maybe') return <b>?</b>;
    return null;
};

export const Sheet: React.FC<{
    hk: HKPublic; my: HKPrivate; notes: Notes;
    onCell: (letter: string, col: string) => void;
    onFocus: (playerId: string) => void;
}> = ({ hk, my, notes, onCell, onFocus }) => {
    const opps = opponentsOf(hk, my.me);
    const owners = knownOwners(hk, my);
    const cols: { id: string; cap: number; head: React.ReactNode; name: string }[] = [
        ...opps.map(p => ({ id: p.id, cap: hk.setup.hand, name: p.name, head: <Avatar p={p} size={26} /> })),
        { id: HOOKY_COL, cap: HOOKY_COUNT, name: 'Hooky', head: <span className="hk-col-bell"><BellGlyph size={22} /></span> }
    ];
    const yesCount = (col: string) => LETTERS.filter(l => effectiveMark(notes, owners, l, col) === 'yes').length;
    const style = { '--cols': cols.length } as any;
    const issues = sheetIssues(hk, my, notes);

    return (
        <>
        {issues.messages.length > 0 && (
            <div className="hk-issues" role="alert">
                <b>Something doesn&rsquo;t add up</b>
                <ul>{issues.messages.map(m => <li key={m}>{m}</li>)}</ul>
            </div>
        )}
        <div className="hk-sheet" style={style}>
            <div className="hk-sheet-row head">
                <div className="hk-sheet-label" />
                {cols.map(c => {
                    const n = yesCount(c.id);
                    const cls = ['hk-sheet-head', n === c.cap ? 'full' : '', issues.cols[c.id] ? 'over' : ''];
                    const body = <>{c.head}<span className="nm">{c.name}</span><span className="cnt">{n}/{c.cap}</span></>;
                    return c.id === HOOKY_COL
                        ? <div key={c.id} className={cls.join(' ')}>{body}</div>
                        : (
                            <button key={c.id} type="button" className={[...cls, 'focusable'].join(' ')}
                                onClick={() => onFocus(c.id)} aria-label={`Show every question put to ${c.name}`}>
                                {body}
                                <span className="hk-zoom" aria-hidden="true">⌕</span>
                            </button>
                        );
                })}
            </div>
            {LETTERS.map(l => {
                const owner = owners[l];
                const rowCls = owner === 'me' ? 'mine' : owner === 'pg' ? 'pg' : owner ? 'known' : '';
                const issue = issues.rows[l];
                const recess = issues.recess.indexOf(l) !== -1;
                return (
                    <div key={l} className={['hk-sheet-row', rowCls, issue ? `bad bad-${issue}` : '', recess ? 'recess' : ''].join(' ')}>
                        <div className="hk-sheet-label" title={issue === 'multi' ? 'Ticked in more than one place'
                            : issue === 'none' ? 'Crossed off everywhere' : recess ? 'Crossed off everywhere: must be a face-down Playground card' : undefined}>
                            <Tile ch={l} size={26} />
                            {issue && <span className="hk-flag" aria-label="contradiction">!</span>}
                            {recess && <span className="hk-flag recess" aria-label="must be on the Playground"><SlideGlyph size={12} /></span>}
                        </div>
                        {cols.map(c => {
                            const auto = autoMark(owners, l, c.id);
                            const m = auto || notes[cellKey(l, c.id)] || null;
                            return (
                                <button key={c.id} type="button"
                                    className={['hk-cell', m ? `m-${m}` : '', auto ? 'auto' : '',
                                        issue === 'multi' && m === 'yes' ? 'clash' : ''].join(' ')}
                                    disabled={!!auto}
                                    aria-label={`${l} for ${c.name}: ${m || 'blank'}`}
                                    onClick={() => onCell(l, c.id)}>
                                    <MarkGlyph m={m} />
                                </button>
                            );
                        })}
                    </div>
                );
            })}
        </div>
        </>
    );
};

// ---------------------------------------------------------------------------
// Focus: every question one player has answered, letter by letter
// ---------------------------------------------------------------------------

/** How many times each letter occurs in a word. */
export function letterCounts(word: string): Record<string, number> {
    const c: Record<string, number> = {};
    for (const ch of word) c[ch] = (c[ch] || 0) + 1;
    return c;
}

/** Questions answered by `target`: their introduction, then every question put to them. */
export const questionsFor = (hk: HKPublic, target: string): LogEntry[] =>
    hk.log.filter(e => (e.kind === 'clue' && e.by === target) || (e.kind === 'ask' && e.target === target));

/**
 * Row status from your own marks only (no deduction is filled in):
 * 'done' — every letter of the word is marked and the ✓s add up to the answer;
 * 'bad'  — the ✓s already exceed the answer, or too many ✗s leave it unreachable.
 */
export function rowStatus(word: string, count: number, markOf: (l: string) => Mark | null): '' | 'done' | 'bad' {
    const ms = word.split('').map(markOf);
    const yes = ms.filter(m => m === 'yes').length;
    const no = ms.filter(m => m === 'no').length;
    if (yes > count || WORD_LEN - no < count) return 'bad';
    if (yes === count && yes + no === WORD_LEN) return 'done';
    return '';
}

export type GridOrient = 'portrait' | 'landscape';

/**
 * Every question one player has answered, against the 26 letters. A cell holds
 * how many times the letter occurs in that word; letters are tinted by your
 * marks for this player, and a strip of mark buttons lets you annotate them.
 *
 *   portrait  (default): letters down the side, one column per question, the
 *             marks column pinned on the right; the question header row stays
 *             pinned while the grid scrolls inside a phone-height box.
 *   landscape: one row per question, letters across the top, the word column
 *             pinned on the left and the marks row along the bottom.
 */
export const FocusGrid: React.FC<{
    hk: HKPublic; my: HKPrivate; notes: Notes; target: string; compact: boolean; orient: GridOrient;
    onCell: (letter: string, col: string) => void;
    onFocus: (playerId: string | null) => void;
    onCompact: (v: boolean) => void;
    onOrient: (o: GridOrient) => void;
}> = ({ hk, my, notes, target, compact, orient, onCell, onFocus, onCompact, onOrient }) => {
    const owners = knownOwners(hk, my);
    const opps = opponentsOf(hk, my.me);
    const p = opps.find(o => o.id === target);
    if (!p) return null;
    const qs = questionsFor(hk, target);
    const counts = qs.map(q => letterCounts(q.word!));
    const used = new Set(qs.flatMap(q => q.word!.split('')));
    const letters = compact ? LETTERS.filter(l => used.has(l)) : LETTERS;
    const markOf = (l: string) => effectiveMark(notes, owners, l, target);
    const found = LETTERS.filter(l => markOf(l) === 'yes').length;
    const cap = hk.setup.hand;
    const by = (id: string | null) => id === my.me ? 'You' : (hk.players.find(x => x.id === id)?.name || '');
    const portrait = orient !== 'landscape';

    // ---- shared pieces ----
    const markCls = (l: string) => {
        const m = markOf(l);
        return [m ? `m-${m}` : '', autoMark(owners, l, target) ? 'auto' : ''].join(' ');
    };
    const markButton = (l: string) => (
        <button key={`mk-${l}`} type="button" disabled={!!autoMark(owners, l, target)}
            className={['hk-qgrid-mark', markCls(l)].join(' ')}
            aria-label={`${l} for ${p.name}: ${markOf(l) || 'blank'}`}
            onClick={() => onCell(l, target)}>
            <MarkGlyph m={markOf(l)} />
        </button>
    );
    const countCell = (i: number, l: string) => {
        const n = counts[i][l] || 0;
        const m = markOf(l);
        return (
            <div key={`c-${i}-${l}`} className={['hk-qgrid-cell', m ? `m-${m}` : '', n ? 'hit' : ''].join(' ')}>
                {n ? <b>{n}</b> : null}
            </div>
        );
    };
    const questionLabel = (q: LogEntry, cls: string) => (
        <div key={`q-${q.id}`} className={[cls, rowStatus(q.word!, q.count!, markOf)].join(' ')}
            title={`${by(q.by)}${q.unlisted ? ' (unlisted)' : ''}`}>
            <span className="rd">{q.kind === 'clue' ? 'Hi' : `R${q.round}`}</span>
            <span className="w">{q.word}</span>
            <span className={['hk-mini-stamp', q.count === 0 ? 'zero' : ''].join(' ')}>{q.count}</span>
        </div>
    );
    const marksLabel = (cls: string) => (
        <div key="mk-label" className={cls}>
            <Avatar p={p} size={20} />
            <span>Your marks</span>
        </div>
    );

    const landscapeGrid = (
        <div className="hk-qgrid-scroll">
            <div className="hk-qgrid" style={{ '--n': letters.length } as any}>
                <div className="hk-qgrid-corner"><span>word</span><span>=</span></div>
                {letters.map(l => (
                    <div key={`h-${l}`} className={['hk-qgrid-head', markCls(l)].join(' ')}><span className="l">{l}</span></div>
                ))}
                {qs.map((q, i) => (
                    <React.Fragment key={q.id}>
                        {questionLabel(q, 'hk-qgrid-word')}
                        {letters.map(l => countCell(i, l))}
                    </React.Fragment>
                ))}
                {marksLabel('hk-qgrid-marklabel')}
                {letters.map(markButton)}
            </div>
        </div>
    );

    const portraitGrid = (
        <div className="hk-qgrid-scroll portrait">
            <div className="hk-pgrid" style={{ '--q': qs.length } as any}>
                <div className="hk-pgrid-corner" />
                {qs.map(q => questionLabel(q, 'hk-pgrid-q'))}
                {marksLabel('hk-pgrid-markhead')}
                {letters.map(l => (
                    <React.Fragment key={l}>
                        <div className={['hk-pgrid-letter', markCls(l)].join(' ')}>{l}</div>
                        {qs.map((_, i) => countCell(i, l))}
                        {markButton(l)}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );

    return (
        <div className="hk-focus">
            <div className="hk-focus-bar">
                <button className="hk-btn small ghost" onClick={() => onFocus(null)}>‹ Sheet</button>
                <div className="hk-chips hk-focus-chips">
                    {opps.map(o => (
                        <button key={o.id} className={o.id === target ? 'on' : ''} onClick={() => onFocus(o.id)}>
                            <Avatar p={o} size={18} /> {o.name}
                        </button>
                    ))}
                </div>
            </div>
            <div className="hk-focus-title">
                <Avatar p={p} size={30} />
                <b>{p.name}</b>
                <span className={['cnt', found === cap ? 'full' : '', found > cap ? 'over' : ''].join(' ')}>✓ {found}/{cap}</span>
            </div>
            <div className="hk-focus-opts">
                <div className="hk-seg small" role="group" aria-label="Grid layout">
                    <button className={portrait ? 'on' : ''} aria-pressed={portrait} onClick={() => onOrient('portrait')}>
                        <span className="ico">↕</span> A–Z down
                    </button>
                    <button className={!portrait ? 'on' : ''} aria-pressed={!portrait} onClick={() => onOrient('landscape')}>
                        <span className="ico">↔</span> A–Z across
                    </button>
                </div>
                <label className="hk-focus-compact">
                    <input type="checkbox" checked={compact} onChange={e => onCompact(e.target.checked)} /> only letters asked
                </label>
            </div>
            <p className="hk-muted hk-sheet-help">
                Numbers show how often a letter is in each word. Tap {portrait ? 'the right-hand column' : 'the bottom row'} to
                cycle your mark for {p.name}: ✓ → ✗ → ? → blank.
            </p>
            {qs.length === 0 && <p className="hk-muted center">Nobody has asked {p.name} anything yet.</p>}
            {(qs.length > 0 || !compact) && (portrait ? portraitGrid : landscapeGrid)}
            <p className="hk-muted hk-qgrid-key">
                <span><i className="k done" /> every letter marked, ✓s match the answer</span>
                <span><i className="k bad" /> your marks can&rsquo;t match the answer</span>
            </p>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Question log
// ---------------------------------------------------------------------------

const pmap = (hk: HKPublic) => {
    const m: Record<string, HKPlayer> = {};
    hk.players.forEach(p => { m[p.id] = p; });
    return m;
};

export const LogEntryRow: React.FC<{
    e: LogEntry; hk: HKPublic; my: HKPrivate; notes: Notes; owners: Record<string, string>; big?: boolean;
}> = ({ e, hk, my, notes, owners, big }) => {
    const pm = pmap(hk);
    const by = e.by ? pm[e.by] : null;
    const target = e.target ? pm[e.target] : null;
    const nm = (p: HKPlayer | null) => !p ? 'Someone' : p.id === my.me ? 'You' : p.name;
    const anim = fresh(my.me, `log-${e.id}-${big ? 'b' : 's'}`);
    const size = big ? 40 : 26;

    if (e.kind === 'playground') {
        return (
            <div className="hk-log-row playground">
                <SlideGlyph size={big ? 26 : 18} />
                <span className="txt"><b>Recess!</b> {STUDENTS[e.letter!]} is at the playground</span>
                <StudentCard letter={e.letter} size={big ? 'sm' : 'xs'} anim={anim ? 'flip' : null} />
            </div>
        );
    }
    if (e.kind === 'reveal') {
        const peek = my.peeks.find(p => p.logId === e.id);
        return (
            <div className="hk-log-row reveal">
                {by && <Avatar p={by} size={big ? 30 : 22} />}
                <span className="txt">
                    <b>{nm(by)}</b> showed <b>{STUDENTS[e.letter!]}</b> and peeked at{' '}
                    {target && target.id === my.me ? <b>your hand</b> : <><b>{nm(target)}</b>&rsquo;s hand</>}
                    {peek && <span className="hk-peek-note"> — you saw <b>{peek.letter}</b> ({STUDENTS[peek.letter]})</span>}
                </span>
                <StudentCard letter={e.letter} size={big ? 'sm' : 'xs'} anim={anim ? 'flip' : null} />
            </div>
        );
    }
    const marks = e.word ? wordMarks(e.word, e.target!, notes, owners, my.me, my.hand) : undefined;
    return (
        <div className={['hk-log-row', e.kind].join(' ')}>
            <div className="who">
                {by && <Avatar p={by} size={big ? 30 : 22} />}
                {e.kind === 'ask' && <span className="arrow">→</span>}
                {e.kind === 'ask' && target && <Avatar p={target} size={big ? 30 : 22} />}
                <span className="nm">
                    {e.kind === 'clue'
                        ? <><b>{nm(by)}</b> introduced {by && by.id === my.me ? 'yourself' : 'themself'}</>
                        : <><b>{nm(by)}</b> asked <b>{target && target.id === my.me ? 'you' : nm(target)}</b></>}
                    {e.unlisted && <span className="hk-unlisted" title="Not in the word list — the asker used it anyway">unlisted</span>}
                </span>
            </div>
            <div className="what">
                <TileWord word={e.word!} size={size} anim={anim} marks={marks} stagger={big ? 90 : 40} />
                <span className="eq">=</span>
                <Stamp n={e.count!} anim={anim} size={big ? 50 : 32} delay={big ? 560 : 220} />
            </div>
        </div>
    );
};

export const QuestionLog: React.FC<{
    hk: HKPublic; my: HKPrivate; notes: Notes; filter: string; onFilter: (f: string) => void;
}> = ({ hk, my, notes, filter, onFilter }) => {
    const owners = knownOwners(hk, my);
    const about = (e: LogEntry) => filter === 'all' || e.target === filter || (e.kind === 'clue' && e.by === filter);
    const entries = hk.log.filter(e => filter === 'all' ? true : (e.kind === 'ask' || e.kind === 'clue') && about(e));
    const rounds: number[] = [];
    entries.forEach(e => { if (rounds.indexOf(e.round) === -1) rounds.push(e.round); });
    rounds.sort((a, b) => b - a);

    return (
        <div className="hk-log">
            <div className="hk-chips" role="tablist">
                <button className={filter === 'all' ? 'on' : ''} onClick={() => onFilter('all')}>Everything</button>
                {hk.players.map(p => (
                    <button key={p.id} className={filter === p.id ? 'on' : ''} onClick={() => onFilter(p.id)}>
                        <Avatar p={p} size={18} /> {p.id === my.me ? 'You' : p.name}
                    </button>
                ))}
            </div>
            {filter !== 'all' && <p className="hk-muted">Every word put to {filter === my.me ? 'you' : (hk.players.find(p => p.id === filter) || { name: '' }).name}. Tiles are tinted by your notes.</p>}
            {entries.length === 0 && <p className="hk-muted center">Nothing yet.</p>}
            {rounds.map(r => (
                <div key={r} className="hk-log-round">
                    <div className="hk-log-round-title">{r === 0 ? 'Introductions' : `Round ${r}`}</div>
                    {entries.filter(e => e.round === r).reverse().map(e => (
                        <LogEntryRow key={e.id} e={e} hk={hk} my={my} notes={notes} owners={owners} />
                    ))}
                </div>
            ))}
        </div>
    );
};

/** The Notes tab: the deduction sheet or the question log. */
export const NotesView: React.FC<{
    hk: HKPublic; my: HKPrivate; notes: Notes; tab: 'sheet' | 'log'; filter: string;
    onCell: (l: string, c: string) => void; onTab: (t: 'sheet' | 'log') => void;
    onFilter: (f: string) => void; onClear: () => void;
    focus: string | null; onFocus: (id: string | null) => void; compact: boolean; onCompact: (v: boolean) => void;
    orient: GridOrient; onOrient: (o: GridOrient) => void;
}> = (p) => (
    <div className="hk-root hk-notes">
        <div className="hk-seg wide">
            <button className={p.tab === 'sheet' ? 'on' : ''} onClick={() => p.onTab('sheet')}>Deduction sheet</button>
            <button className={p.tab === 'log' ? 'on' : ''} onClick={() => p.onTab('log')}>Questions ({p.hk.log.filter(e => e.kind === 'ask' || e.kind === 'clue').length})</button>
        </div>
        {p.tab === 'sheet' && p.focus ? (
            <FocusGrid hk={p.hk} my={p.my} notes={p.notes} target={p.focus} compact={p.compact} orient={p.orient}
                onCell={p.onCell} onFocus={p.onFocus} onCompact={p.onCompact} onOrient={p.onOrient} />
        ) : p.tab === 'sheet' ? (
            <>
                <p className="hk-muted hk-sheet-help">Tap a square to cycle it: ✓ has it → ✗ not it → ? maybe → blank. Faded marks are certain and filled in for you. Tap a player&rsquo;s name to see every question they&rsquo;ve answered.</p>
                <Sheet hk={p.hk} my={p.my} notes={p.notes} onCell={p.onCell} onFocus={p.onFocus} />
                <div className="hk-sheet-foot">
                    <button className="hk-btn small ghost" onClick={() => { if (window.confirm('Erase all your marks?')) p.onClear(); }}>Erase all my marks</button>
                </div>
            </>
        ) : (
            <QuestionLog hk={p.hk} my={p.my} notes={p.notes} filter={p.filter} onFilter={p.onFilter} />
        )}
        {p.hk.phase === Phase.Done && <p className="hk-muted center">Game over. Your notes stay here until a new game starts.</p>}
    </div>
);
