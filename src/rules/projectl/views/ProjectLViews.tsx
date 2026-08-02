/**
 * ProjectLViews.tsx — React views for Project L.
 *
 * Presentation only: every mutation goes through an MP RPC method. The board
 * rendering and touch placement come from the reusable polyomino library
 * (`client/lib/polyomino`). UI-only interaction state (which piece/puzzle is
 * being placed) lives in component state; game state never does.
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';

import { PolyBoard, BoardPlacement } from '../../../client/lib/polyomino/PolyBoard';
import { PolyShape } from '../../../client/lib/polyomino/PolyShape';
import { PolyPlacer } from '../../../client/lib/polyomino/PolyPlacer';

import {
    SHAPES, SHAPE_IDS, ShapeId, orientationsFor, shapesAtLevel,
    PUZZLE_BY_ID, PuzzleDef, BOARD_W, BOARD_H, MAX_LEVEL,
    MAX_UNFINISHED_PUZZLES
} from '../ProjectLData';
import { Phase, PuzzleInstance, PlacementRec } from '../ProjectLGameState';

// ============================================================================
// Prop shapes
// ============================================================================

interface PublicPlayer {
    puzzles: PuzzleInstance[];
    vpPile: { puzzleId: number; points: number }[];
    vpPoints: number;
    supply: Record<ShapeId, number>;
    pieceCount: number;
    finishingTouchPieces: number;
    finishingDone: boolean;
}

interface SoloView {
    difficulty: string;
    grid: (number | null)[];
    locks: number[];
    deckCount: number;
    opponentSupply: number;
    opponentVpCount: number;
    opponentVpPoints: number;
}

interface ProjectLProps extends ViewPropsInterface {
    mode: 'multiplayer' | 'solo' | 'speed';
    phase: Phase;
    round: number;
    actionsLeft: number;
    currentPlayerId: string;
    playerOrder: string[];
    endTriggered: boolean;
    finalTurns: number | null;
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    publicPlayers: Record<string, PublicPlayer>;
    shared: {
        whiteRow: (number | null)[];
        blackRow: (number | null)[];
        whiteDeckCount: number;
        blackDeckCount: number;
        reserve: Record<ShapeId, number>;
    };
    solo: SoloView | null;
    scores: Record<string, number> | null;
    winnerIds: string[] | null;
    soloResult: 'win' | 'lose' | null;
    isHost: boolean;
    mySupply: Record<ShapeId, number> | null;
    myPuzzles: PuzzleInstance[];
    myFinishingDone: boolean;
    isMyTurn: boolean;
    // ---- speed contest ----
    speedBoard?: SpeedEntry[];
    serverNow?: number;
    startEpoch?: number;
    movePenalty?: number;
    myMoves?: number;
    myCleared?: boolean;
    allCleared?: boolean;
}

interface SpeedEntry {
    id: string;
    name: string;
    accent: string;
    moveCount: number;
    whiteDeck: number;
    blackDeck: number;
    cleared: boolean;
    clearEpoch: number | null;
}

// ============================================================================
// Small presentational helpers
// ============================================================================

/** A single polyomino glyph in its shape colour. */
const PieceGlyph: React.FC<{ shapeId: ShapeId; unit?: number; ghost?: boolean }> = ({ shapeId, unit = 15, ghost }) => (
    <PolyShape cells={SHAPES[shapeId].cells} color={SHAPES[shapeId].color} unit={unit} ghost={ghost} title={shapeId} />
);

function placementsOf(inst: PuzzleInstance | undefined): BoardPlacement[] {
    if (!inst) return [];
    return inst.placements.map((pl: PlacementRec) => ({ mask: pl.mask, color: SHAPES[pl.shapeId].color }));
}

/** A puzzle rendered as a flat card: point value, reward chip, and its board. */
const PuzzleCard: React.FC<{
    puzzle: PuzzleDef;
    instance?: PuzzleInstance;
    unit?: number;
    extraPlacements?: BoardPlacement[];
    onClick?: () => void;
    actionLabel?: string;
    highlight?: boolean;
    compact?: boolean;
    fill?: boolean;
}> = ({ puzzle, instance, unit = 26, extraPlacements = [], onClick, actionLabel, highlight, compact, fill }) => {
    const placements = [...placementsOf(instance), ...extraPlacements];
    const clickable = !!onClick;
    return (
        <div
            className={[
                'pl-puzzle-card',
                `deck-${puzzle.deck}`,
                clickable ? 'clickable' : '',
                highlight ? 'highlight' : '',
                compact ? 'compact' : '',
                fill ? 'fill' : ''
            ].filter(Boolean).join(' ')}
            onClick={onClick}
            role={clickable ? 'button' : undefined}
        >
            <div className="pl-puzzle-head">
                <span className="pl-points">{puzzle.points}</span>
                <span className="pl-reward" title={`reward: ${puzzle.reward}`}>
                    <PieceGlyph shapeId={puzzle.reward} unit={9} />
                </span>
            </div>
            <PolyBoard
                width={BOARD_W}
                height={BOARD_H}
                recessed={puzzle.recessed}
                unit={unit}
                placements={placements}
                showWellDots={!compact}
            />
            {actionLabel && <div className="pl-card-action">{actionLabel}</div>}
        </div>
    );
};

/** Face-down deck stub with a remaining-count badge. */
const DeckStub: React.FC<{ label: string; count: number; onClick?: () => void; deck: 'white' | 'black' }> =
    ({ label, count, onClick, deck }) => (
        <div
            className={['pl-deck-stub', `deck-${deck}`, onClick ? 'clickable' : ''].filter(Boolean).join(' ')}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
        >
            <span className="pl-deck-count">{count}</span>
            <span className="pl-deck-label">{label}</span>
            {onClick && <span className="pl-deck-hint">draw</span>}
        </div>
    );

/** The three action "pips" showing remaining actions this turn. */
const ActionPips: React.FC<{ left: number; total?: number }> = ({ left, total = 3 }) => (
    <span className="pl-pips" aria-label={`${left} of ${total} actions left`}>
        {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={['pl-pip', i < left ? 'on' : 'off'].join(' ')} />
        ))}
    </span>
);

// ============================================================================
// Supply tray
// ============================================================================

const SupplyTray: React.FC<{
    supply: Record<ShapeId, number>;
    selectable?: boolean;
    selectedShape?: ShapeId | null;
    onSelect?: (s: ShapeId) => void;
    dimZero?: boolean;
    dividers?: boolean;
}> = ({ supply, selectable, selectedShape, onSelect, dimZero = true, dividers = true }) => {
    const nodes: React.ReactNode[] = [];
    let prevLevel = 0;
    SHAPE_IDS.forEach((s) => {
        const level = SHAPES[s].level;
        if (dividers && prevLevel !== 0 && level !== prevLevel) {
            nodes.push(<span key={`div-${level}`} className="pl-supply-divider" aria-hidden="true" />);
        }
        prevLevel = level;
        const count = supply[s] || 0;
        const zero = count === 0;
        const disabled = selectable && zero;
        nodes.push(
            <button
                key={s}
                type="button"
                className={[
                    'pl-supply-piece',
                    selectedShape === s ? 'selected' : '',
                    zero && dimZero ? 'empty' : ''
                ].filter(Boolean).join(' ')}
                disabled={!selectable || disabled}
                onClick={selectable && !zero ? () => onSelect && onSelect(s) : undefined}
            >
                <span className="pl-supply-glyph"><PieceGlyph shapeId={s} unit={13} /></span>
                <span className="pl-supply-count">{count}</span>
                <span className="pl-supply-lvl">L{level}</span>
            </button>
        );
    });
    return <div className="pl-supply-tray">{nodes}</div>;
};

// ============================================================================
// Placement overlay (single Place / Finishing-touches place)
// ============================================================================

interface PlacementOverlayProps {
    instance: PuzzleInstance;
    supply: Record<ShapeId, number>;
    title: string;
    costHint?: string;
    onCommit: (shapeId: ShapeId, mask: number) => void;
    onClose: () => void;
}
interface PlacementOverlayState { shapeId: ShapeId | null; }

class PlacementOverlay extends React.Component<PlacementOverlayProps, PlacementOverlayState> {
    constructor(props: PlacementOverlayProps) {
        super(props);
        const firstOwned = SHAPE_IDS.find(s => (props.supply[s] || 0) > 0) || null;
        this.state = { shapeId: firstOwned };
    }
    public render() {
        const { instance, supply, title, costHint } = this.props;
        const puzzle = PUZZLE_BY_ID[instance.puzzleId];
        const shapeId = this.state.shapeId;
        return (
            <div className="pl-overlay" onClick={this.props.onClose}>
                <div className="pl-overlay-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="pl-overlay-head">
                        <h3>{title}</h3>
                        {costHint && <span className="pl-cost-hint">{costHint}</span>}
                        <button className="pl-x" onClick={this.props.onClose} aria-label="Close">✕</button>
                    </div>

                    {shapeId ? (
                        <PolyPlacer
                            key={shapeId + '-' + instance.placements.length}
                            width={BOARD_W}
                            height={BOARD_H}
                            recessed={puzzle.recessed}
                            unit={52}
                            placements={placementsOf(instance)}
                            shape={{
                                cells: SHAPES[shapeId].cells,
                                color: SHAPES[shapeId].color,
                                orientations: orientationsFor(shapeId)
                            }}
                            onCommit={(mask) => this.props.onCommit(shapeId, mask)}
                            onCancel={this.props.onClose}
                        />
                    ) : (
                        <div className="pl-empty-note">You have no pieces to place.</div>
                    )}

                    <div className="pl-picker-label">Choose a piece</div>
                    <SupplyTray
                        supply={supply}
                        selectable
                        selectedShape={shapeId}
                        onSelect={(s) => this.setState({ shapeId: s })}
                    />
                </div>
            </div>
        );
    }
}

// ============================================================================
// Master overlay — stage up to one piece per puzzle, commit as one action
// ============================================================================

interface MasterStage { puzzleIndex: number; shapeId: ShapeId; mask: number; }
interface MasterOverlayProps {
    puzzles: PuzzleInstance[];
    supply: Record<ShapeId, number>;
    onCommit: (stages: MasterStage[]) => void;
    onClose: () => void;
}
interface MasterOverlayState { stages: MasterStage[]; editing: number | null; shapeId: ShapeId | null; }

class MasterOverlay extends React.Component<MasterOverlayProps, MasterOverlayState> {
    constructor(props: MasterOverlayProps) {
        super(props);
        this.state = { stages: [], editing: null, shapeId: null };
    }

    /** Supply after subtracting already-staged pieces. */
    private remainingSupply(): Record<ShapeId, number> {
        const s = { ...this.props.supply };
        for (const st of this.state.stages) s[st.shapeId] = (s[st.shapeId] || 0) - 1;
        return s;
    }

    private startEditing = (idx: number) => {
        const rem = this.remainingSupply();
        const firstOwned = SHAPE_IDS.find(x => (rem[x] || 0) > 0) || null;
        this.setState({ editing: idx, shapeId: firstOwned });
    };

    private stagePlacement = (mask: number) => {
        const { editing, shapeId } = this.state;
        if (editing === null || !shapeId) return;
        const stages = this.state.stages.filter(s => s.puzzleIndex !== editing);
        stages.push({ puzzleIndex: editing, shapeId, mask });
        this.setState({ stages, editing: null, shapeId: null });
    };

    private clearStage = (idx: number) => {
        this.setState({ stages: this.state.stages.filter(s => s.puzzleIndex !== idx) });
    };

    public render() {
        const { puzzles, supply } = this.props;
        const { stages, editing, shapeId } = this.state;
        const rem = this.remainingSupply();

        if (editing !== null && shapeId !== null) {
            const inst = puzzles[editing];
            const puzzle = PUZZLE_BY_ID[inst.puzzleId];
            const staged = stages.filter(s => s.puzzleIndex !== editing);
            const extra = staged
                .filter(s => s.puzzleIndex === editing)
                .map(s => ({ mask: s.mask, color: SHAPES[s.shapeId].color }));
            return (
                <div className="pl-overlay" onClick={this.props.onClose}>
                    <div className="pl-overlay-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="pl-overlay-head">
                            <h3>Master — puzzle {editing + 1}</h3>
                            <button className="pl-x" onClick={() => this.setState({ editing: null, shapeId: null })} aria-label="Back">✕</button>
                        </div>
                        <PolyPlacer
                            key={'m-' + editing + '-' + shapeId}
                            width={BOARD_W}
                            height={BOARD_H}
                            recessed={puzzle.recessed}
                            unit={50}
                            placements={[...placementsOf(inst), ...extra]}
                            shape={{
                                cells: SHAPES[shapeId].cells,
                                color: SHAPES[shapeId].color,
                                orientations: orientationsFor(shapeId)
                            }}
                            confirmLabel="Stage"
                            onCommit={this.stagePlacement}
                            onCancel={() => this.setState({ editing: null, shapeId: null })}
                        />
                        <div className="pl-picker-label">Choose a piece</div>
                        <SupplyTray supply={rem} selectable selectedShape={shapeId} onSelect={(s) => this.setState({ shapeId: s })} />
                    </div>
                </div>
            );
        }

        return (
            <div className="pl-overlay" onClick={this.props.onClose}>
                <div className="pl-overlay-panel wide" onClick={(e) => e.stopPropagation()}>
                    <div className="pl-overlay-head">
                        <h3>Master — one piece per puzzle</h3>
                        <button className="pl-x" onClick={this.props.onClose} aria-label="Close">✕</button>
                    </div>
                    <p className="pl-hint-text">Stage up to one piece into each puzzle, then commit — the whole Master counts as a single action.</p>
                    <div className="pl-master-grid">
                        {puzzles.map((inst, i) => {
                            const puzzle = PUZZLE_BY_ID[inst.puzzleId];
                            const stage = stages.find(s => s.puzzleIndex === i);
                            const extra = stage ? [{ mask: stage.mask, color: SHAPES[stage.shapeId].color, pending: true }] : [];
                            return (
                                <div key={i} className="pl-master-cell">
                                    <PuzzleCard puzzle={puzzle} instance={inst} unit={26} extraPlacements={extra} />
                                    {stage ? (
                                        <button className="pl-btn tiny ghost" onClick={() => this.clearStage(i)}>Clear</button>
                                    ) : (
                                        <button className="pl-btn tiny" onClick={() => this.startEditing(i)}>+ Piece</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="pl-overlay-actions">
                        <button className="pl-btn ghost" onClick={this.props.onClose}>Cancel</button>
                        <button className="pl-btn primary" disabled={stages.length === 0} onClick={() => this.props.onCommit(stages)}>
                            Commit Master ({stages.length})
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

// ============================================================================
// Upgrade overlay
// ============================================================================

interface UpgradeOverlayProps {
    supply: Record<ShapeId, number>;
    reserve: Record<ShapeId, number>;
    onTakeL1: () => void;
    onSwap: (from: ShapeId, to: ShapeId) => void;
    onClose: () => void;
}
class UpgradeOverlay extends React.Component<UpgradeOverlayProps, { from: ShapeId | null }> {
    constructor(props: UpgradeOverlayProps) {
        super(props);
        this.state = { from: null };
    }
    private targetsFor(from: ShapeId): ShapeId[] {
        const fromLevel = SHAPES[from].level;
        // same level, any lower level, or exactly one level higher
        const out: ShapeId[] = [];
        for (let L = 1; L <= Math.min(MAX_LEVEL, fromLevel + 1); L++) {
            for (const s of shapesAtLevel(L)) out.push(s);
        }
        return out.filter(s => s !== from);
    }
    public render() {
        const { supply } = this.props;
        const from = this.state.from;
        return (
            <div className="pl-overlay" onClick={this.props.onClose}>
                <div className="pl-overlay-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="pl-overlay-head">
                        <h3>Upgrade</h3>
                        <button className="pl-x" onClick={this.props.onClose} aria-label="Close">✕</button>
                    </div>
                    <button className="pl-btn primary block" onClick={this.props.onTakeL1}>
                        <PieceGlyph shapeId="mono" unit={13} /> &nbsp;Take a new Level-1 piece
                    </button>
                    <div className="pl-or">or swap a piece</div>
                    <div className="pl-picker-label">Return this piece</div>
                    <SupplyTray supply={supply} selectable selectedShape={from} onSelect={(s) => this.setState({ from: s })} />
                    {from && (
                        <>
                            <div className="pl-picker-label">Take (same level, lower, or +1 level)</div>
                            <div className="pl-upgrade-targets">
                                {this.targetsFor(from).map((t) => (
                                    <button key={t} type="button" className="pl-supply-piece" onClick={() => this.props.onSwap(from, t)}>
                                        <span className="pl-supply-glyph"><PieceGlyph shapeId={t} unit={13} /></span>
                                        <span className="pl-lvl">L{SHAPES[t].level}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }
}

// ============================================================================
// Market (multiplayer rows) + Solo area
// ============================================================================

const Market: React.FC<{
    p: ProjectLProps;
    /** may take a puzzle (active turn + under the 4-puzzle cap) */
    canTake: boolean;
    /** active turn with an action to spend (Recycle does not need a free puzzle slot) */
    active: boolean;
    onTakeRow: (deck: 'white' | 'black', slot: number) => void;
    onTakeDeck: (deck: 'white' | 'black') => void;
    onRecycle: (deck: 'white' | 'black') => void;
}> = ({ p, canTake, active, onTakeRow, onTakeDeck, onRecycle }) => {
    const renderRow = (deck: 'white' | 'black', row: (number | null)[], deckCount: number) => {
        const hasCards = row.some(x => x != null);
        return (
        <div className={`pl-market-row deck-${deck}`}>
            <div className="pl-row-header">
                <span className="pl-row-label">{deck}</span>
                <div className="pl-row-tools">
                    <DeckStub deck={deck} label="deck" count={deckCount} onClick={canTake && deckCount > 0 ? () => onTakeDeck(deck) : undefined} />
                    {active && hasCards && (
                        <button className="pl-btn tiny ghost recycle" onClick={() => onRecycle(deck)} title="Recycle this row" aria-label="Recycle row">
                            <span className="pl-recycle-glyph">↻</span> Recycle
                        </button>
                    )}
                </div>
            </div>
            <div className="pl-row-grid">
                {row.map((pid, slot) => pid == null ? (
                    <div key={slot} className="pl-puzzle-empty" />
                ) : (
                    <PuzzleCard
                        key={slot}
                        puzzle={PUZZLE_BY_ID[pid]}
                        unit={26}
                        compact
                        fill
                        onClick={canTake ? () => onTakeRow(deck, slot) : undefined}
                        actionLabel={canTake ? 'Take' : undefined}
                    />
                ))}
            </div>
        </div>
        );
    };
    return (
        <div className="pl-market">
            {renderRow('white', p.shared.whiteRow, p.shared.whiteDeckCount)}
            {renderRow('black', p.shared.blackRow, p.shared.blackDeckCount)}
        </div>
    );
};

const SoloArea: React.FC<{
    p: ProjectLProps;
    canTake: boolean;
    onTakeGrid: (pos: number) => void;
    onTakeDeck: () => void;
}> = ({ p, canTake, onTakeGrid, onTakeDeck }) => {
    const solo = p.solo!;
    return (
        <div className="pl-solo">
            <div className="pl-solo-top">
                <div className="pl-solo-decknote">
                    <DeckStub deck="white" label="deck" count={solo.deckCount} onClick={canTake && solo.deckCount > 0 ? onTakeDeck : undefined} />
                    <span className="pl-solo-decklabel">Draw blind</span>
                </div>
                <div className="pl-solo-opponent">
                    <div className="pl-solo-opp-title">AI</div>
                    <div className="pl-solo-opp-vp">{solo.opponentVpPoints} pts · {solo.opponentVpCount} solved</div>
                    <div className="pl-solo-opp-supply">supply: {solo.opponentSupply}</div>
                    <div className="pl-solo-diff">{solo.difficulty}</div>
                </div>
            </div>

            {/* locks above each column */}
            <div className="pl-solo-locks">
                {[0, 1, 2].map((c) => (
                    <div key={c} className="pl-lock-col">
                        {Array.from({ length: solo.locks[c] }).map((_, i) => <span key={i} className="pl-lock-token" />)}
                        {solo.locks[c] === 0 && <span className="pl-lock-open">open</span>}
                    </div>
                ))}
            </div>

            <div className="pl-solo-grid">
                {solo.grid.map((pid, pos) => pid == null ? (
                    <div key={pos} className="pl-puzzle-empty grid" />
                ) : (
                    <PuzzleCard
                        key={pos}
                        puzzle={PUZZLE_BY_ID[pid]}
                        unit={26}
                        compact
                        fill
                        onClick={canTake ? () => onTakeGrid(pos) : undefined}
                        actionLabel={canTake ? 'Take' : undefined}
                    />
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// Players panel (opponents' public boards)
// ============================================================================

const PlayersPanel: React.FC<{ p: ProjectLProps }> = ({ p }) => (
    <div className="pl-players-panel">
        {p.playerOrder.map((id) => {
            const pub = p.publicPlayers[id];
            if (!pub) return null;
            const isCurrent = id === p.currentPlayerId;
            const accent = p.playerAccents[id];
            return (
                <div key={id} className={['pl-player-block', isCurrent ? 'active' : ''].join(' ')} style={{ borderColor: accent }}>
                    <div className="pl-player-head">
                        <span className="pl-player-name" style={{ color: accent }}>{p.playerNames[id]}</span>
                        <span className="pl-player-vp">{pub.vpPoints} pts</span>
                        <span className="pl-player-solved">{pub.vpPile.length} solved</span>
                    </div>
                    <div className="pl-player-section">
                        <span className="pl-mini-label">Active</span>
                        <div className="pl-player-puzzles">
                            {pub.puzzles.length === 0 && <span className="pl-muted">none</span>}
                            {pub.puzzles.map((inst, i) => (
                                <PuzzleCard key={i} puzzle={PUZZLE_BY_ID[inst.puzzleId]} instance={inst} unit={18} compact />
                            ))}
                        </div>
                    </div>
                    <div className="pl-player-section">
                        <span className="pl-mini-label">Solved</span>
                        <div className="pl-player-solved-cards">
                            {pub.vpPile.length === 0 && <span className="pl-muted">none yet</span>}
                            {pub.vpPile.map((v, i) => (
                                <PuzzleCard
                                    key={i}
                                    puzzle={PUZZLE_BY_ID[v.puzzleId]}
                                    unit={16}
                                    compact
                                    extraPlacements={[{ mask: PUZZLE_BY_ID[v.puzzleId].recessed, color: accent }]}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="pl-player-supply">
                        {SHAPE_IDS.filter(s => pub.supply[s] > 0).map(s => (
                            <span key={s} className="pl-mini-piece"><PieceGlyph shapeId={s} unit={10} /><b>{pub.supply[s]}</b></span>
                        ))}
                        {pub.pieceCount === 0 && <span className="pl-muted">no pieces</span>}
                    </div>
                </div>
            );
        })}
    </div>
);

// ============================================================================
// Scoring panel
// ============================================================================

const ScoringPanel: React.FC<{ p: ProjectLProps }> = ({ p }) => {
    const scores = p.scores || {};
    if (p.mode === 'solo') {
        const you = scores[p.playerOrder[0]] ?? 0;
        const opp = (scores as any)['opponent'] ?? 0;
        const won = p.soloResult === 'win';
        return (
            <div className="pl-scoring">
                <h2 className={won ? 'win' : 'lose'}>{won ? 'You win!' : 'The AI wins'}</h2>
                <div className="pl-score-rows">
                    <div className="pl-score-row"><span>You</span><b>{you}</b></div>
                    <div className="pl-score-row"><span>AI</span><b>{opp}</b></div>
                </div>
                <p className="pl-muted">You win only by beating the AI — a tie goes to the AI.</p>
            </div>
        );
    }
    const ranked = [...p.playerOrder].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
    const winners = new Set(p.winnerIds || []);
    return (
        <div className="pl-scoring">
            <h2 className="win">
                {winners.size > 1 ? 'Shared victory!' : `${p.playerNames[[...winners][0]] || 'Winner'} wins!`}
            </h2>
            <div className="pl-score-rows">
                {ranked.map((id) => (
                    <div key={id} className={['pl-score-row', winners.has(id) ? 'winner' : ''].join(' ')}>
                        <span style={{ color: p.playerAccents[id] }}>{p.playerNames[id]}</span>
                        <b>{scores[id] ?? 0}</b>
                        {winners.has(id) && <span className="pl-crown">★</span>}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// Speed contest scoreboard (live wall-clock)
// ============================================================================

function fmtTime(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const SPEED_START_BLACK = 12 - 4; // SPEED_BLACK_COUNT − ROW_SIZE = black draw pile at start

interface SpeedScoreboardProps {
    board: SpeedEntry[];
    serverNow: number;
    startEpoch: number;
    movePenalty: number;
    meId: string;
    final: boolean;
}

class SpeedScoreboard extends React.Component<SpeedScoreboardProps, {}> {
    private timer: any = null;
    private skew = 0;

    constructor(props: SpeedScoreboardProps) {
        super(props);
        this.skew = Date.now() - props.serverNow; // host↔client clock offset
    }
    public componentDidMount() {
        // tick the wall clock locally between host updates
        this.timer = setInterval(() => this.forceUpdate(), 500);
    }
    public componentDidUpdate(prev: SpeedScoreboardProps) {
        if (prev.serverNow !== this.props.serverNow) this.skew = Date.now() - this.props.serverNow;
    }
    public componentWillUnmount() {
        if (this.timer) clearInterval(this.timer);
    }

    public render() {
        const { board, startEpoch, movePenalty, meId, final } = this.props;
        const hostNow = Date.now() - this.skew;
        const rows = board.map((e) => {
            const endMs = (e.cleared && e.clearEpoch != null) ? e.clearEpoch : hostNow;
            const wall = Math.max(0, (endMs - startEpoch) / 1000);
            const score = wall + movePenalty * e.moveCount;
            return { ...e, wall, score };
        }).sort((a, b) => a.score - b.score);

        return (
            <div className={['pl-speedboard', final ? 'final' : ''].join(' ')}>
                <div className="pl-speedboard-head">
                    <span>{final ? 'Final results' : 'Race'}</span>
                    <span className="pl-speedboard-sub">time + {movePenalty}s / move</span>
                </div>
                <div className="pl-speed-rows">
                    {rows.map((e, i) => {
                        const progress = Math.min(1, (SPEED_START_BLACK - e.blackDeck) / Math.max(1, SPEED_START_BLACK));
                        return (
                            <div key={e.id} className={['pl-speed-row', e.id === meId ? 'me' : '', e.cleared ? 'cleared' : ''].join(' ')}>
                                <span className="pl-speed-rank">{i + 1}</span>
                                <span className="pl-speed-name" style={{ color: e.accent }}>{e.name}{e.id === meId ? ' (you)' : ''}</span>
                                <div className="pl-speed-mid">
                                    <div className="pl-speed-bar"><div className="pl-speed-bar-fill" style={{ width: `${progress * 100}%`, background: e.accent }} /></div>
                                    <span className="pl-speed-counts">
                                        <span className="pl-chip black">{e.blackDeck} black</span>
                                        <span className="pl-chip white">{e.whiteDeck} white</span>
                                        <span className="pl-chip">{e.moveCount} moves</span>
                                    </span>
                                </div>
                                <span className="pl-speed-score">
                                    <b>{fmtTime(e.score)}</b>
                                    {e.cleared ? <span className="pl-speed-done">✓ cleared</span> : null}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
}

// ============================================================================
// Rules reference
// ============================================================================

const RulesView: React.FC = () => (
    <div className="pl-rules">
        <h3>Project L</h3>
        <p>Build an engine of polyomino pieces and use them to fill recessed puzzles. Completing a puzzle earns victory points and a new piece. Most points win.</p>
        <h4>Your turn — 3 actions</h4>
        <ul>
            <li><b>Take</b> a puzzle from a row (or blind from a deck). Max 4 unfinished at once.</li>
            <li><b>Upgrade</b>: take a new Level-1 piece, or swap one for the same level, any lower level, or one level higher.</li>
            <li><b>Recycle</b> a whole row to the bottom of its deck and reveal four fresh puzzles.</li>
            <li><b>Place</b> one piece into one of your puzzles. Placed pieces lock until the puzzle is finished.</li>
            <li><b>Master</b> (once per turn): place one piece into <i>each</i> of your puzzles as a single action.</li>
        </ul>
        <h4>Completing</h4>
        <p>Fill every recessed cell exactly once. You get the pieces back, plus the reward piece, and the puzzle scores its points.</p>
        <h4>Piece levels</h4>
        <div className="pl-legend">
            {SHAPE_IDS.map(s => (
                <span key={s} className="pl-legend-item">
                    <PieceGlyph shapeId={s} unit={14} /><small>L{SHAPES[s].level}</small>
                </span>
            ))}
        </div>
        <h4>Game end</h4>
        <p>When the black deck runs out, finish the round and play one more. Then Finishing Touches: place any pieces for −1 point each. Score your solved puzzles, minus any unfinished puzzle values and finishing pieces.</p>
        <h4>Speed contest</h4>
        <p>Every racer gets the <b>same</b> deck and plays their own board in real time — no turns, no interference. Cards score no points; the goal is simply to empty your <b>black deck</b> as fast as possible. Your score is wall-clock time plus 6 seconds per move (take, place, upgrade, master, recycle). Lowest time wins; play continues until everyone has cleared.</p>
    </div>
);

// ============================================================================
// Lobby views
// ============================================================================

export class ProjectLHostLobby extends React.Component<ViewPropsInterface, {}> {
    private setDifficulty(d: string) { (this.props.MP as any).setDifficulty(d); }
    private setGameMode(m: string) { (this.props.MP as any).setGameMode(m); }
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const solo = playerCount === 1;
        const difficulty = mp.getData ? (mp.getData('projectl_difficulty') || 'normal') : 'normal';
        const gamemode = mp.getData ? (mp.getData('projectl_gamemode') || 'standard') : 'standard';
        const isSpeed = gamemode === 'speed';
        const links: any = {
            'home': {
                'icon': 'home',
                'label': 'Lobby',
                'view': (
                    <div className="pl-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="pl-difficulty">
                            <div className="pl-picker-label">Game mode</div>
                            <div className="pl-diff-buttons">
                                <button
                                    className={['pl-btn small', !isSpeed ? 'primary' : ''].join(' ')}
                                    onClick={() => this.setGameMode('standard')}
                                >{solo ? 'Solo' : 'Standard'}</button>
                                <button
                                    className={['pl-btn small', isSpeed ? 'primary' : ''].join(' ')}
                                    onClick={() => this.setGameMode('speed')}
                                >Speed contest</button>
                            </div>
                        </div>
                        {solo && !isSpeed && (
                            <div className="pl-difficulty">
                                <div className="pl-picker-label">Solo difficulty (AI starting pieces)</div>
                                <div className="pl-diff-buttons">
                                    {['normal', 'hard', 'unbeatable'].map((d) => (
                                        <button
                                            key={d}
                                            className={['pl-btn small', difficulty === d ? 'primary' : ''].join(' ')}
                                            onClick={() => this.setDifficulty(d)}
                                        >{d}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="pl-muted">
                            {isSpeed
                                ? 'Speed contest: every racer gets the same deck and rushes to empty their black deck. Time + 6s per move — fastest wins.'
                                : (solo ? 'Solo mode vs a deterministic AI.' : `${playerCount} players.`)} Project L supports 1–6.
                        </p>
                    </div>
                )
            },
            'clients': {
                'icon': 'users',
                'label': 'Players',
                'view': mp.getPluginView('lobby', 'host-roommanagement')
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Project L', 'links': links });
    }
}

export class ProjectLClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card', 'label': 'Lobby',
                'view': (
                    <div className="pl-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="pl-waiting">Waiting for the host to start…</div>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Project L', 'links': links });
    }
}

// ============================================================================
// Main page
// ============================================================================

type UIMode =
    | { kind: 'idle' }
    | { kind: 'place'; puzzleIndex: number }
    | { kind: 'master' }
    | { kind: 'upgrade' }
    | { kind: 'finishing'; puzzleIndex: number };

export class ProjectLMainPage extends React.Component<ProjectLProps, { ui: UIMode }> {
    constructor(props: ProjectLProps) {
        super(props);
        this.state = { ui: { kind: 'idle' } };
    }

    private mp() { return this.props.MP as any; }
    private close = () => this.setState({ ui: { kind: 'idle' } });

    private amActive(): boolean {
        return this.props.isMyTurn && this.props.phase === Phase.Play && this.props.actionsLeft > 0;
    }

    // ---- action senders ----
    private takeRow = (deck: 'white' | 'black', slot: number) => { this.mp().takeRow(deck, slot); };
    private takeDeck = (deck: 'white' | 'black') => { this.mp().takeDeck(deck); };
    private takeSoloGrid = (pos: number) => { this.mp().takeSoloGrid(pos); };
    private takeSoloDeck = () => { this.mp().takeSoloDeck(); };
    private recycle = (deck: 'white' | 'black') => { this.mp().recycle(deck); };
    private commitPlace = (shapeId: ShapeId, mask: number) => {
        if (this.state.ui.kind !== 'place') return;
        this.mp().place(this.state.ui.puzzleIndex, shapeId, mask);
        this.close();
    };
    private commitMaster = (stages: MasterStage[]) => {
        this.mp().master(stages);
        this.close();
    };
    private commitFinishing = (shapeId: ShapeId, mask: number) => {
        if (this.state.ui.kind !== 'finishing') return;
        this.mp().finishingPlace(this.state.ui.puzzleIndex, shapeId, mask);
        this.close();
    };
    private upgradeTakeL1 = () => { this.mp().upgradeTakeL1(); this.close(); };
    private upgradeSwap = (from: ShapeId, to: ShapeId) => { this.mp().upgradeSwap(from, to); this.close(); };
    private pass = () => { this.mp().pass(); };
    private finishingDone = () => { this.mp().finishingDone(); };

    // ---- sub-renders ----
    private topBar(): string {
        const p = this.props;
        if (p.mode === 'speed') {
            if (p.allCleared) return 'Race complete';
            if (p.myCleared) return 'Cleared · waiting';
            return `Speed race · ${p.myMoves || 0} moves`;
        }
        if (p.phase === Phase.Play) {
            const name = p.playerNames[p.currentPlayerId] || 'Player';
            return p.isMyTurn ? `Your turn · ${p.actionsLeft} left` : `${name}'s turn`;
        }
        if (p.phase === Phase.FinishingTouches) return 'Finishing touches';
        if (p.phase === Phase.Scoring) return 'Final scores';
        return 'Project L';
    }

    /** The "your puzzles / actions / pieces" block, shared by both arenas. */
    private renderMyBoard(active: boolean, opts: { finishing?: boolean; showEndTurn?: boolean } = {}) {
        const p = this.props;
        const finishing = !!opts.finishing;
        const canTakePuzzle = active && p.myPuzzles.length < MAX_UNFINISHED_PUZZLES;
        return (
            <>
                {p.mode === 'solo' && p.solo
                    ? <SoloArea p={p} canTake={canTakePuzzle} onTakeGrid={this.takeSoloGrid} onTakeDeck={this.takeSoloDeck} />
                    : <Market p={p} canTake={canTakePuzzle} active={active} onTakeRow={this.takeRow} onTakeDeck={this.takeDeck} onRecycle={this.recycle} />}

                <div className="pl-section-title">Your puzzles ({p.myPuzzles.length}/4)</div>
                <div className="pl-my-puzzles">
                    {p.myPuzzles.length === 0 && <div className="pl-muted pad">Take a puzzle to begin.</div>}
                    {p.myPuzzles.map((inst, i) => (
                        <div key={i} className="pl-my-puzzle">
                            <PuzzleCard puzzle={PUZZLE_BY_ID[inst.puzzleId]} instance={inst} unit={30} />
                            {(active || (finishing && !p.myFinishingDone)) && (
                                <button
                                    className="pl-btn small block"
                                    onClick={() => this.setState({ ui: finishing ? { kind: 'finishing', puzzleIndex: i } : { kind: 'place', puzzleIndex: i } })}
                                >
                                    Place
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {active && (
                    <div className="pl-actionbar">
                        <button className="pl-btn" onClick={() => this.setState({ ui: { kind: 'upgrade' } })}>Upgrade</button>
                        {p.myPuzzles.length > 0 && (
                            <button className="pl-btn" onClick={() => this.setState({ ui: { kind: 'master' } })}>Master</button>
                        )}
                        {opts.showEndTurn && <button className="pl-btn ghost" onClick={this.pass}>End turn</button>}
                    </div>
                )}

                <div className="pl-section-title">Your pieces</div>
                {p.mySupply && <SupplyTray supply={p.mySupply} />}
            </>
        );
    }

    private renderSpeedArena() {
        const p = this.props;
        const active = this.amActive();
        return (
            <div className="pl-arena">
                <SpeedScoreboard
                    board={p.speedBoard || []}
                    serverNow={p.serverNow || Date.now()}
                    startEpoch={p.startEpoch || 0}
                    movePenalty={p.movePenalty || 6}
                    meId={this.mp().clientId}
                    final={!!p.allCleared}
                />

                {p.allCleared && <div className="pl-ft-bar done">Everyone cleared their black deck — final results above.</div>}
                {!p.allCleared && p.myCleared && (
                    <div className="pl-ft-bar done">You cleared your black deck! Waiting for the other racers…</div>
                )}

                {!p.myCleared && (
                    <>
                        <div className="pl-speed-hint">Race to empty your <b>black deck</b>. Cards score no points — fastest wall-clock time wins (+{p.movePenalty || 6}s per move).</div>
                        {this.renderMyBoard(active, { showEndTurn: false })}
                    </>
                )}

                {this.renderOverlay()}
            </div>
        );
    }

    private renderArena() {
        const p = this.props;

        if (p.mode === 'speed') return this.renderSpeedArena();
        if (p.phase === Phase.Scoring) return <ScoringPanel p={p} />;

        const active = this.amActive();
        const finishing = p.phase === Phase.FinishingTouches;

        return (
            <div className="pl-arena">
                {/* HUD */}
                <div className={['pl-hud', p.isMyTurn && p.phase === Phase.Play ? 'mine' : ''].join(' ')}>
                    <div className="pl-hud-left">
                        <span className="pl-round">Round {p.round + 1}</span>
                        {p.phase === Phase.Play && <ActionPips left={p.actionsLeft} />}
                    </div>
                    <div className="pl-hud-right">
                        {p.endTriggered && p.phase === Phase.Play && <span className="pl-endflag">Final rounds</span>}
                        {finishing && <span className="pl-endflag ft">Finishing touches · −1 / piece</span>}
                    </div>
                </div>

                {/* Finishing-touches controls */}
                {finishing && !p.myFinishingDone && (
                    <div className="pl-ft-bar">
                        <span>Place extra pieces at −1 each, then finish.</span>
                        <button className="pl-btn primary small" onClick={this.finishingDone}>I'm done</button>
                    </div>
                )}
                {finishing && p.myFinishingDone && <div className="pl-ft-bar done">Waiting for other players…</div>}

                {this.renderMyBoard(active, { finishing, showEndTurn: true })}

                {this.renderOverlay()}
            </div>
        );
    }

    private renderOverlay() {
        const p = this.props;
        const ui = this.state.ui;
        if (!p.mySupply) return null;
        if (ui.kind === 'place') {
            const inst = p.myPuzzles[ui.puzzleIndex];
            if (!inst) return null;
            return <PlacementOverlay instance={inst} supply={p.mySupply} title={`Place a piece — puzzle ${ui.puzzleIndex + 1}`} onCommit={this.commitPlace} onClose={this.close} />;
        }
        if (ui.kind === 'finishing') {
            const inst = p.myPuzzles[ui.puzzleIndex];
            if (!inst) return null;
            return <PlacementOverlay instance={inst} supply={p.mySupply} title={`Finishing touch — puzzle ${ui.puzzleIndex + 1}`} costHint="−1 point" onCommit={this.commitFinishing} onClose={this.close} />;
        }
        if (ui.kind === 'master') {
            return <MasterOverlay puzzles={p.myPuzzles} supply={p.mySupply} onCommit={this.commitMaster} onClose={this.close} />;
        }
        if (ui.kind === 'upgrade') {
            return <UpgradeOverlay supply={p.mySupply} reserve={p.shared.reserve} onTakeL1={this.upgradeTakeL1} onSwap={this.upgradeSwap} onClose={this.close} />;
        }
        return null;
    }

    public render() {
        const p = this.props;
        const mp = this.mp();

        const links: any = {
            'home': { 'icon': 'th', 'label': 'Board', 'view': this.renderArena() }
        };
        // In the speed contest the live scoreboard replaces the shared players view.
        if (p.mode !== 'speed') {
            links['players'] = { 'icon': 'users', 'label': 'Players', 'view': <PlayersPanel p={p} /> };
        }
        links['rules'] = { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> };
        if (p.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Settings',
                'view': (
                    <div className="pl-settings">
                        <button className="pl-btn primary" onClick={() => mp.restartGame()}>Restart game</button>
                        <button className="pl-btn ghost" onClick={() => mp.backToLobby()}>Back to lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Project L',
            'links': links,
            'topBarContent': this.topBar(),
            'roomClassName': (p.isMyTurn && p.phase === Phase.Play) ? 'attention-bg' : ''
        });
    }
}
